import { describe, it, expect } from 'vitest';
import { detectHallucination, extractEntities } from '../../../src/modules/hallucination/detector.js';
import { GuardianError } from '../../../src/core/errors.js';

describe('extractEntities', () => {
  it('extracts proper nouns', () => {
    const entities = extractEntities('Albert Einstein was born in Ulm Germany in 1879.');
    expect(entities.some((e) => e.includes('Albert Einstein'))).toBe(true);
  });

  it('extracts years', () => {
    const entities = extractEntities('The event happened in 2023.');
    expect(entities).toContain('2023');
  });

  it('extracts quoted strings', () => {
    const entities = extractEntities('He said "hello world" to everyone.');
    expect(entities).toContain('hello world');
  });

  it('filters out trivial small numbers', () => {
    const entities = extractEntities('There are 5 items and 42 results.');
    expect(entities).not.toContain('5');
    expect(entities).not.toContain('42');
  });

  it('returns empty array for plain text with no entities', () => {
    const entities = extractEntities('hello how are you doing today');
    expect(entities).toHaveLength(0);
  });
});

describe('detectHallucination', () => {
  it('returns grounded when all entities found in sources', () => {
    const sources = ['Albert Einstein was born in Ulm Germany in 1879.'];
    const response = 'Albert Einstein was born in 1879.';
    const result = detectHallucination(response, { sources });
    expect(result.suspected).toBe(false);
    expect(result.groundingScore).toBeGreaterThanOrEqual(0.6);
  });

  it('suspects hallucination when entities not in sources', () => {
    const sources = ['The sky is blue.'];
    const response = 'Napoleon Bonaparte conquered Russia in 1812.';
    const result = detectHallucination(response, { sources, threshold: 0.8 });
    expect(result.suspected).toBe(true);
    expect(result.groundingScore).toBeLessThan(0.8);
  });

  it('returns safe when no sources provided', () => {
    const result = detectHallucination('Some response', { sources: [] });
    expect(result.suspected).toBe(false);
    expect(result.groundingScore).toBe(1);
  });

  it('returns safe when response has no extractable entities', () => {
    const result = detectHallucination('yes no maybe', { sources: ['some source'] });
    expect(result.suspected).toBe(false);
    expect(result.groundingScore).toBe(1);
  });

  it('throws GuardianError when throwOnDetection is true', () => {
    const sources = ['The sky is blue.'];
    const response = 'Napoleon Bonaparte conquered Russia in 1812.';
    expect(() =>
      detectHallucination(response, { sources, threshold: 0.8, throwOnDetection: true })
    ).toThrow(GuardianError);
  });
});
