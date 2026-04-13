import { describe, it, expect } from 'vitest';
import { generateCanaryToken, injectCanary, checkCanaryLeak } from '../../../src/modules/canary/index.js';
import { GuardianError } from '../../../src/core/errors.js';

describe('generateCanaryToken', () => {
  it('generates a token with default prefix', () => {
    const token = generateCanaryToken();
    expect(token).toMatch(/^\[CNRY:[A-Za-z0-9+/=]+\]$/);
  });

  it('generates a token with custom prefix', () => {
    const token = generateCanaryToken('TEST');
    expect(token).toMatch(/^\[TEST:[A-Za-z0-9+/=]+\]$/);
  });

  it('generates unique tokens each time', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateCanaryToken()));
    expect(tokens.size).toBe(20);
  });
});

describe('injectCanary', () => {
  it('appends canary token as HTML comment', () => {
    const token = '[CNRY:ABC123]';
    const result = injectCanary('Hello world', token);
    expect(result).toContain('Hello world');
    expect(result).toContain(`<!-- ${token} -->`);
  });
});

describe('checkCanaryLeak', () => {
  it('detects leaked token in output', () => {
    const token = generateCanaryToken();
    const output = `Here is your answer. ${token} Hope that helps!`;
    const result = checkCanaryLeak(output, token, { enabled: true, throwOnLeak: false });
    expect(result.leaked).toBe(true);
  });

  it('returns not leaked when token absent', () => {
    const token = generateCanaryToken();
    const result = checkCanaryLeak('Clean response here.', token, { enabled: true, throwOnLeak: false });
    expect(result.leaked).toBe(false);
  });

  it('throws GuardianError when throwOnLeak is true', () => {
    const token = generateCanaryToken();
    const output = `Leaked: ${token}`;
    expect(() =>
      checkCanaryLeak(output, token, { enabled: true, throwOnLeak: true })
    ).toThrow(GuardianError);
  });

  it('does not throw when throwOnLeak is false', () => {
    const token = generateCanaryToken();
    const output = `Leaked: ${token}`;
    expect(() =>
      checkCanaryLeak(output, token, { enabled: true, throwOnLeak: false })
    ).not.toThrow();
  });
});
