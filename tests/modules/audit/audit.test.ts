import { describe, it, expect } from 'vitest';
import { buildAuditEntry } from '../../../src/modules/audit/index.js';
import type { GuardianMeta } from '../../../src/types/index.js';

const baseMeta: GuardianMeta = {
  piiRedacted: [],
  injectionDetected: [],
  budget: null,
  repairAttempts: 0,
  durationMs: 42,
  canaryLeaked: false,
  contentViolation: false,
  hallucinationSuspected: false,
  hallucinationScore: 1,
};

describe('buildAuditEntry', () => {
  it('builds a valid audit entry', () => {
    const entry = buildAuditEntry('hello prompt', 'hello output', baseMeta);
    expect(entry.promptLength).toBe(12);
    expect(entry.outputLength).toBe(12);
    expect(entry.durationMs).toBe(42);
    expect(entry.piiRedactedCount).toBe(0);
    expect(entry.injectionDetected).toBe(false);
    expect(entry.tokensUsed).toBeNull();
    expect(entry.estimatedCostUSD).toBeNull();
    expect(entry.model).toBeNull();
  });

  it('includes ISO timestamp', () => {
    const entry = buildAuditEntry('p', 'o', baseMeta);
    expect(() => new Date(entry.timestamp)).not.toThrow();
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it('generates consistent promptHash for same input', () => {
    const a = buildAuditEntry('same prompt', 'out', baseMeta);
    const b = buildAuditEntry('same prompt', 'out', baseMeta);
    expect(a.promptHash).toBe(b.promptHash);
  });

  it('generates different promptHash for different inputs', () => {
    const a = buildAuditEntry('prompt A', 'out', baseMeta);
    const b = buildAuditEntry('prompt B', 'out', baseMeta);
    expect(a.promptHash).not.toBe(b.promptHash);
  });

  it('includes PII types from meta', () => {
    const meta: GuardianMeta = {
      ...baseMeta,
      piiRedacted: [
        { type: 'email', value: 'x@x.com', start: 0, end: 7, redactedWith: '[REDACTED:EMAIL]' },
        { type: 'email', value: 'y@y.com', start: 10, end: 17, redactedWith: '[REDACTED:EMAIL]' },
        { type: 'phone', value: '0600000000', start: 20, end: 30, redactedWith: '[REDACTED:PHONE]' },
      ],
    };
    const entry = buildAuditEntry('p', 'o', meta);
    expect(entry.piiRedactedCount).toBe(3);
    expect(entry.piiTypes).toContain('email');
    expect(entry.piiTypes).toContain('phone');
    expect(entry.piiTypes).toHaveLength(2); // deduped
  });

  it('includes budget info when present', () => {
    const meta: GuardianMeta = {
      ...baseMeta,
      budget: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCostUSD: 0.001,
        model: 'gpt-4o-mini',
      },
    };
    const entry = buildAuditEntry('p', 'o', meta);
    expect(entry.tokensUsed).toBe(150);
    expect(entry.estimatedCostUSD).toBe(0.001);
    expect(entry.model).toBe('gpt-4o-mini');
  });

  it('includes extras (content, hallucination)', () => {
    const entry = buildAuditEntry('p', 'o', baseMeta, {
      contentViolation: true,
      hallucinationSuspected: true,
      hallucinationScore: 0.4,
    });
    expect(entry.contentViolation).toBe(true);
    expect(entry.hallucinationSuspected).toBe(true);
    expect(entry.hallucinationScore).toBe(0.4);
  });
});
