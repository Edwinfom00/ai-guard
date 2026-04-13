import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../../../src/modules/ratelimit/index.js';
import { GuardianError } from '../../../src/core/errors.js';

describe('RateLimiter', () => {
  it('allows requests under the limit', () => {
    const limiter = new RateLimiter({ maxRequests: 5 });
    expect(() => {
      for (let i = 0; i < 5; i++) limiter.check('prompt');
    }).not.toThrow();
  });

  it('throws when request limit exceeded', () => {
    const limiter = new RateLimiter({ maxRequests: 2 });
    limiter.check('prompt');
    limiter.check('prompt');
    expect(() => limiter.check('prompt')).toThrow(GuardianError);
  });

  it('throws when token limit exceeded via addTokens', () => {
    const limiter = new RateLimiter({ maxTokens: 100 });
    limiter.check('prompt');
    expect(() => limiter.addTokens('prompt', 200)).toThrow(GuardianError);
  });

  it('does not double-count requests when addTokens is called', () => {
    const limiter = new RateLimiter({ maxRequests: 2, maxTokens: 1000 });
    limiter.check('prompt');
    limiter.addTokens('prompt', 50);
    limiter.check('prompt');
    limiter.addTokens('prompt', 50);
    // Only 2 requests counted — should not throw
    const usage = limiter.getUsage('prompt');
    expect(usage?.requests).toBe(2);
    expect(usage?.tokens).toBe(100);
  });

  it('resets window after windowMs', async () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 50 });
    limiter.check('prompt');
    await new Promise((r) => setTimeout(r, 60));
    expect(() => limiter.check('prompt')).not.toThrow();
  });

  it('isolates buckets by key', () => {
    const limiter = new RateLimiter({
      maxRequests: 1,
      keyFn: (p) => p,
    });
    limiter.check('user-a');
    expect(() => limiter.check('user-b')).not.toThrow();
    expect(() => limiter.check('user-a')).toThrow(GuardianError);
  });

  it('reset() clears all buckets', () => {
    const limiter = new RateLimiter({ maxRequests: 1 });
    limiter.check('prompt');
    limiter.reset();
    expect(() => limiter.check('prompt')).not.toThrow();
  });

  it('getUsage returns null for unknown key', () => {
    const limiter = new RateLimiter();
    expect(limiter.getUsage('unknown')).toBeNull();
  });
});
