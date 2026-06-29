import { describe, it, expect } from 'vitest';
import { RedisRateLimitStore, GenericRedisClient } from '../../../src/modules/ratelimit/redis.js';
import { RateLimiter } from '../../../src/modules/ratelimit/index.js';
import { GuardianError } from '../../../src/core/errors.js';

class MockRedisClient implements GenericRedisClient {
  public store = new Map<string, Record<string, string>>();
  public ttls = new Map<string, number>();

  exists(key: string): number {
    return this.store.has(key) ? 1 : 0;
  }

  hincrby(key: string, field: string, increment: number): number {
    if (!this.store.has(key)) {
      this.store.set(key, {});
    }
    const hash = this.store.get(key)!;
    const current = hash[field] ? parseInt(hash[field]!, 10) : 0;
    const next = current + increment;
    hash[field] = String(next);
    return next;
  }

  hget(key: string, field: string): string | null {
    const hash = this.store.get(key);
    if (!hash) return null;
    return hash[field] !== undefined ? hash[field]! : null;
  }

  hset(key: string, field: string, value: string): number {
    if (!this.store.has(key)) {
      this.store.set(key, {});
    }
    const hash = this.store.get(key)!;
    hash[field] = value;
    return 1;
  }

  pexpire(key: string, milliseconds: number): number {
    this.ttls.set(key, Date.now() + milliseconds);
    return 1;
  }

  hgetall(key: string): Record<string, string> | null {
    const expiry = this.ttls.get(key);
    if (expiry && Date.now() > expiry) {
      this.store.delete(key);
      this.ttls.delete(key);
      return null;
    }
    return this.store.get(key) ?? null;
  }

  keys(pattern: string): string[] {
    return Array.from(this.store.keys());
  }

  del(key: string): number {
    this.store.delete(key);
    this.ttls.delete(key);
    return 1;
  }
}

describe('RedisRateLimitStore & RateLimiter integration', () => {
  it('should increment requests and add tokens via MockRedisClient', async () => {
    const client = new MockRedisClient();
    const store = new RedisRateLimitStore(client);

    const r1 = await store.incrementRequests('user-1', 60_000);
    expect(r1.requests).toBe(1);
    expect(client.store.has('ai_guard:ratelimit:user-1')).toBe(true);

    const r2 = await store.incrementRequests('user-1', 60_000);
    expect(r2.requests).toBe(2);

    const t1 = await store.addTokens('user-1', 500, 60_000);
    expect(t1.tokens).toBe(500);

    const usage = await store.getUsage('user-1');
    expect(usage).not.toBeNull();
    expect(usage?.requests).toBe(2);
    expect(usage?.tokens).toBe(500);
  });

  it('should block requests when maxRequests exceeded under RateLimiter', async () => {
    const client = new MockRedisClient();
    const store = new RedisRateLimitStore(client);
    
    const limiter = new RateLimiter({
      maxRequests: 2,
      windowMs: 60_000,
      store,
    });

    await limiter.check('test');
    await limiter.check('test');

    await expect(limiter.check('test')).rejects.toThrow(GuardianError);
  });

  it('should block token usage when maxTokens exceeded', async () => {
    const client = new MockRedisClient();
    const store = new RedisRateLimitStore(client);

    const limiter = new RateLimiter({
      maxTokens: 1000,
      windowMs: 60_000,
      store,
    });

    await limiter.check('test');
    await limiter.addTokens('test', 800);
    
    await expect(limiter.addTokens('test', 300)).rejects.toThrow(GuardianError);
  });
});
