import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../../../src/modules/ratelimit/index.js';
import { GuardianError } from '../../../src/core/errors.js';

describe('RateLimiter', () => {
  it('allows requests under the limit', async () => {
    const limiter = new RateLimiter({ maxRequests: 5 });
    await expect((async () => {
      for (let i = 0; i < 5; i++) await limiter.check('prompt');
    })()).resolves.not.toThrow();
  });

  it('throws when request limit exceeded', async () => {
    const limiter = new RateLimiter({ maxRequests: 2 });
    await limiter.check('prompt');
    await limiter.check('prompt');
    await expect(limiter.check('prompt')).rejects.toThrow(GuardianError);
  });

  it('throws when token limit exceeded via addTokens', async () => {
    const limiter = new RateLimiter({ maxTokens: 100 });
    await limiter.check('prompt');
    await expect(limiter.addTokens('prompt', 200)).rejects.toThrow(GuardianError);
  });

  it('does not double-count requests when addTokens is called', async () => {
    const limiter = new RateLimiter({ maxRequests: 2, maxTokens: 1000 });
    await limiter.check('prompt');
    await limiter.addTokens('prompt', 50);
    await limiter.check('prompt');
    await limiter.addTokens('prompt', 50);
    // Only 2 requests counted — should not throw
    const usage = await limiter.getUsage('prompt');
    expect(usage?.requests).toBe(2);
    expect(usage?.tokens).toBe(100);
  });

  it('resets window after windowMs', async () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 50 });
    await limiter.check('prompt');
    await new Promise((r) => setTimeout(r, 60));
    await expect(limiter.check('prompt')).resolves.not.toThrow();
  });

  it('isolates buckets by key', async () => {
    const limiter = new RateLimiter({
      maxRequests: 1,
      keyFn: (p) => p,
    });
    await limiter.check('user-a');
    await expect(limiter.check('user-b')).resolves.not.toThrow();
    await expect(limiter.check('user-a')).rejects.toThrow(GuardianError);
  });

  it('reset() clears all buckets', async () => {
    const limiter = new RateLimiter({ maxRequests: 1 });
    await limiter.check('prompt');
    await limiter.reset();
    await expect(limiter.check('prompt')).resolves.not.toThrow();
  });

  it('getUsage returns null for unknown key', async () => {
    const limiter = new RateLimiter();
    expect(await limiter.getUsage('unknown')).toBeNull();
  });
});
