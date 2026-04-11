import { GuardianError } from '../../core/errors.js';

export interface RateLimitConfig {
  /** Max requests per time window. Default: 60 */
  maxRequests?: number;
  /** Max tokens per time window. Default: 100_000 */
  maxTokens?: number;
  /** Window size in milliseconds. Default: 60_000 (1 minute) */
  windowMs?: number;
  /**
   * Function that returns a key (user ID, IP, etc.) from the prompt.
   * Default: single global bucket (no per-user isolation).
   */
  keyFn?: (prompt: string) => string;
}

interface Bucket {
  requests: number;
  tokens: number;
  windowStart: number;
}

/**
 * In-memory sliding-window rate limiter.
 * Resets per-key counts every `windowMs` milliseconds.
 *
 * Note: This is process-local — for multi-instance deployments,
 * use a shared store (Redis) with a custom implementation.
 */
export class RateLimiter {
  private readonly config: Required<Omit<RateLimitConfig, 'keyFn'>> & { keyFn: (p: string) => string };
  private readonly buckets = new Map<string, Bucket>();

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      maxRequests: config.maxRequests ?? 60,
      maxTokens:   config.maxTokens   ?? 100_000,
      windowMs:    config.windowMs    ?? 60_000,
      keyFn:       config.keyFn       ?? (() => '__global__'),
    };
  }

  /**
   * Checks and increments the rate limit for the given prompt.
   * Throws GuardianError if the limit is exceeded.
   */
  check(prompt: string, tokensUsed = 0): void {
    const key = this.config.keyFn(prompt);
    const now = Date.now();

    let bucket = this.buckets.get(key);

    // Reset window if expired
    if (!bucket || now - bucket.windowStart >= this.config.windowMs) {
      bucket = { requests: 0, tokens: 0, windowStart: now };
      this.buckets.set(key, bucket);
    }

    bucket.requests++;
    bucket.tokens += tokensUsed;

    if (bucket.requests > this.config.maxRequests) {
      throw new GuardianError(
        'RATE_LIMIT_EXCEEDED',
        `Rate limit exceeded: ${bucket.requests} requests in ${this.config.windowMs}ms window (max: ${this.config.maxRequests})`,
        { key, requests: bucket.requests, limit: this.config.maxRequests }
      );
    }

    if (bucket.tokens > this.config.maxTokens) {
      throw new GuardianError(
        'RATE_LIMIT_EXCEEDED',
        `Token rate limit exceeded: ${bucket.tokens} tokens in window (max: ${this.config.maxTokens})`,
        { key, tokens: bucket.tokens, limit: this.config.maxTokens }
      );
    }
  }

  /** Returns current usage for a key. */
  getUsage(prompt: string): Bucket | null {
    return this.buckets.get(this.config.keyFn(prompt)) ?? null;
  }

  /** Clears all buckets (useful for testing). */
  reset(): void {
    this.buckets.clear();
  }
}
