import { describe, it, expect } from 'vitest';
import { detectContent } from '../../../src/modules/content/detector.js';
import { GuardianError } from '../../../src/core/errors.js';

describe('detectContent', () => {
  it('returns no detection for clean text', () => {
    const result = detectContent('What is the capital of France?', {
      enabled: true,
      sensitivity: 'medium',
      throwOnDetection: false,
    });
    expect(result.detected).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it('detects violence threat', () => {
    const result = detectContent("I will kill you right now", {
      enabled: true,
      sensitivity: 'medium',
      throwOnDetection: false,
    });
    expect(result.detected).toBe(true);
    expect(result.categories).toContain('violence');
  });

  it('detects self-harm ideation', () => {
    const result = detectContent("I want to die and have no reason to live", {
      enabled: true,
      sensitivity: 'high',
      throwOnDetection: false,
    });
    expect(result.detected).toBe(true);
    expect(result.categories).toContain('selfharm');
  });

  it('detects sexual content involving minors (score 1.0)', () => {
    const result = detectContent('child sexual explicit content', {
      enabled: true,
      sensitivity: 'low',
      throwOnDetection: false,
    });
    expect(result.detected).toBe(true);
    expect(result.score).toBe(1.0);
  });

  it('throws GuardianError when throwOnDetection is true', () => {
    expect(() =>
      detectContent("I will kill them all", {
        enabled: true,
        sensitivity: 'medium',
        throwOnDetection: true,
      })
    ).toThrow(GuardianError);
  });

  it('returns no detection when disabled', () => {
    const result = detectContent("I will kill you", { enabled: false });
    expect(result.detected).toBe(false);
  });

  it('filters by category', () => {
    const result = detectContent("I will kill you", {
      enabled: true,
      sensitivity: 'medium',
      categories: ['hate'],
      throwOnDetection: false,
    });
    // violence pattern excluded by category filter
    expect(result.categories.every((c) => c === 'hate')).toBe(true);
  });

  it('detects custom patterns', () => {
    const result = detectContent('BADWORD trigger here', {
      enabled: true,
      sensitivity: 'medium',
      customPatterns: [{ regex: /BADWORD/i, category: 'toxicity', score: 0.9 }],
      throwOnDetection: false,
    });
    expect(result.detected).toBe(true);
    expect(result.categories).toContain('toxicity');
  });
});
