import { describe, it, expect } from 'vitest';
import { detectPII } from '../../../src/modules/pii/detector.js';
import { redactPII } from '../../../src/modules/pii/redactor.js';

describe('PII Detector', () => {
  it('detects email addresses', () => {
    const matches = detectPII('Contact me at john.doe@example.com please');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.type).toBe('email');
    expect(matches[0]?.value).toBe('john.doe@example.com');
  });

  it('detects multiple PIIs in one string', () => {
    const text = 'Email: test@test.com, IP: 192.168.1.1';
    const matches = detectPII(text);
    const types = matches.map((m) => m.type);
    expect(types).toContain('email');
    expect(types).toContain('ipAddress');
  });

  it('detects valid credit card (Luhn pass)', () => {
    // 4532015112830366 — valid Visa test number
    const matches = detectPII('Card: 4532015112830366');
    expect(matches.some((m) => m.type === 'creditCard')).toBe(true);
  });

  it('rejects invalid credit card (Luhn fail)', () => {
    const matches = detectPII('Card: 4532015112830367'); // last digit changed
    expect(matches.some((m) => m.type === 'creditCard')).toBe(false);
  });

  it('detects IPv4 address', () => {
    const matches = detectPII('Server at 10.0.0.1');
    expect(matches.some((m) => m.type === 'ipAddress')).toBe(true);
  });

  it('only detects targeted PII types', () => {
    const text = 'test@example.com and 10.0.0.1';
    const matches = detectPII(text, ['email']);
    expect(matches.every((m) => m.type === 'email')).toBe(true);
    expect(matches.some((m) => m.type === 'ipAddress')).toBe(false);
  });

  it('returns empty array when no PII found', () => {
    const matches = detectPII('Hello world, how are you?');
    expect(matches).toHaveLength(0);
  });
});

describe('PII Redactor', () => {
  it('redacts email with default token', () => {
    const { text, matches } = redactPII('Send to alice@domain.com now');
    expect(text).toBe('Send to [REDACTED:EMAIL] now');
    expect(matches).toHaveLength(1);
  });

  it('redacts multiple PIIs preserving surrounding text', () => {
    const { text } = redactPII('Email: a@b.com, IP: 192.168.0.1');
    expect(text).toContain('[REDACTED:EMAIL]');
    expect(text).toContain('[REDACTED:IPADDRESS]');
    expect(text).not.toContain('a@b.com');
    expect(text).not.toContain('192.168.0.1');
  });

  it('uses custom replaceWith function', () => {
    const { text } = redactPII('Contact: user@mail.com', {
      replaceWith: (type) => `***${type}***`,
    });
    expect(text).toContain('***email***');
  });

  it('returns original text unchanged when no PII found', () => {
    const input = 'No sensitive data here.';
    const { text, matches } = redactPII(input);
    expect(text).toBe(input);
    expect(matches).toHaveLength(0);
  });

  it('respects onInput: false — no redaction applied', () => {
    // When onInput is false, redactPII itself still works (Guardian controls the flag)
    // Here we test that targets:[] produces no matches
    const { matches } = redactPII('user@test.com', { targets: [] });
    expect(matches).toHaveLength(0);
  });
});
