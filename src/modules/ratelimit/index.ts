import { GuardianError } from '../../core/errors.js';
import { RateLimitStore, InMemoryStore } from './store.js';

export type { RateLimitStore } from './store.js';
export { InMemoryStore } from './store.js';
export { RedisRateLimitStore } from './redis.js';
export type { GenericRedisClient } from './redis.js';

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
  /** Optional custom store. Defaults to InMemoryStore. */
  store?: RateLimitStore;
}

interface Bucket {
  requests: number;
  tokens: number;
  windowStart: number;
}

/**
 * Rate limiter supporting memory or distributed Redis stores.
 */
export class RateLimiter {
  private readonly config: Required<Omit<RateLimitConfig, 'keyFn' | 'store'>> & {
    keyFn: (p: string) => string;
    store: RateLimitStore;
  };

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      maxRequests: config.maxRequests ?? 60,
      maxTokens:   config.maxTokens   ?? 100_000,
      windowMs:    config.windowMs    ?? 60_000,
      keyFn:       config.keyFn       ?? (() => '__global__'),
      store:       config.store       ?? new InMemoryStore(),
    };
  }

  /**
   * Checks and increments the rate limit for the given prompt.
   * Throws GuardianError if the limit is exceeded.
   */
  async check(prompt: string): Promise<void> {
    const key = this.config.keyFn(prompt);
    const bucket = await this.config.store.incrementRequests(key, this.config.windowMs);

    if (bucket.requests > this.config.maxRequests) {
      throw new GuardianError(
        'RATE_LIMIT_EXCEEDED',
        `Rate limit exceeded: ${bucket.requests} requests in ${this.config.windowMs}ms window (max: ${this.config.maxRequests})`,
        { key, requests: bucket.requests, limit: this.config.maxRequests }
      );
    }
  }

  /**
   * Adds token usage to the bucket after a provider call completes.
   * Throws if the token limit is exceeded.
   */
  async addTokens(prompt: string, tokensUsed: number): Promise<void> {
    const key = this.config.keyFn(prompt);
    const bucket = await this.config.store.addTokens(key, tokensUsed, this.config.windowMs);

    if (bucket.tokens > this.config.maxTokens) {
      throw new GuardianError(
        'RATE_LIMIT_EXCEEDED',
        `Token rate limit exceeded: ${bucket.tokens} tokens in window (max: ${this.config.maxTokens})`,
        { key, tokens: bucket.tokens, limit: this.config.maxTokens }
      );
    }
  }

  /** Returns current usage for a key. */
  async getUsage(prompt: string): Promise<Bucket | null> {
    return await this.config.store.getUsage(this.config.keyFn(prompt));
  }

  /** Clears all buckets (useful for testing). */
  async reset(): Promise<void> {
    await this.config.store.reset();
  }
}
