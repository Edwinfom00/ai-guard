import { describe, it, expect, vi } from 'vitest';
import { cleanMarkdown, extractJSON, repairAndParse } from '../../../src/modules/schema/repair.js';
import { enforce } from '../../../src/modules/schema/enforcer.js';
import { GuardianError, SchemaValidationError } from '../../../src/core/errors.js';

describe('cleanMarkdown', () => {
  it('strips ```json fences', () => {
    const raw = '```json\n{"name":"Edwin"}\n```';
    expect(cleanMarkdown(raw)).toBe('{"name":"Edwin"}');
  });

  it('strips ``` fences without language tag', () => {
    const raw = '```\n{"ok":true}\n```';
    expect(cleanMarkdown(raw)).toBe('{"ok":true}');
  });

  it('trims whitespace', () => {
    expect(cleanMarkdown('   {"a":1}   ')).toBe('{"a":1}');
  });

  it('returns unchanged string when no fence', () => {
    expect(cleanMarkdown('{"x":1}')).toBe('{"x":1}');
  });
});

describe('extractJSON', () => {
  it('extracts object from surrounding text', () => {
    const raw = 'Here is your result: {"name":"Edwin","age":25} Hope that helps!';
    expect(extractJSON(raw)).toBe('{"name":"Edwin","age":25}');
  });

  it('extracts array from surrounding text', () => {
    const raw = 'Results: [1,2,3] done.';
    expect(extractJSON(raw)).toBe('[1,2,3]');
  });

  it('handles nested objects', () => {
    const raw = 'Got: {"a":{"b":{"c":1}}} end';
    const extracted = extractJSON(raw);
    expect(extracted).toBe('{"a":{"b":{"c":1}}}');
  });

  it('returns null when no JSON found', () => {
    expect(extractJSON('no json here at all')).toBeNull();
  });
});

describe('repairAndParse', () => {
  it('parses clean JSON without repair', async () => {
    const result = await repairAndParse('{"ok":true}', { repair: 'clean' });
    expect(result).toEqual({ ok: true });
  });

  it('repairs markdown fences (Level 1)', async () => {
    const raw = '```json\n{"fixed":true}\n```';
    const result = await repairAndParse(raw, { repair: 'clean' });
    expect(result).toEqual({ fixed: true });
  });

  it('extracts JSON from text (Level 2)', async () => {
    const raw = 'Sure! Here you go: {"name":"Edwin"} Let me know.';
    const result = await repairAndParse(raw, { repair: 'extract' });
    expect(result).toEqual({ name: 'Edwin' });
  });

  it('throws GuardianError when repair:clean fails', async () => {
    await expect(
      repairAndParse('this is not json at all', { repair: 'clean' })
    ).rejects.toThrow(GuardianError);
  });

  it('retries with LLM on repair:retry (Level 3)', async () => {
    const retryFn = vi.fn().mockResolvedValue('{"retried":true}');
    const result = await repairAndParse('broken json !!!', {
      repair: 'retry',
      retryFn,
      maxRetries: 1,
    });
    expect(result).toEqual({ retried: true });
    expect(retryFn).toHaveBeenCalledOnce();
  });

  it('throws after max retries exceeded', async () => {
    const retryFn = vi.fn().mockResolvedValue('still broken !!!');
    await expect(
      repairAndParse('broken', { repair: 'retry', retryFn, maxRetries: 2 })
    ).rejects.toThrow(GuardianError);
    expect(retryFn).toHaveBeenCalledTimes(2);
  });
});

describe('enforce', () => {
  const validator = (data: unknown) => {
    if (
      typeof data === 'object' &&
      data !== null &&
      'name' in data &&
      typeof (data as Record<string, unknown>)['name'] === 'string'
    ) {
      return { success: true as const, data: data as { name: string } };
    }
    return { success: false as const, error: 'Invalid shape' };
  };

  it('validates clean JSON response', async () => {
    const { data } = await enforce('{"name":"Edwin"}', { validator });
    expect(data.name).toBe('Edwin');
  });

  it('repairs and validates markdown-wrapped response', async () => {
    const raw = '```json\n{"name":"Fom"}\n```';
    const { data, repairAttempts } = await enforce(raw, { validator, repair: 'extract' });
    expect(data.name).toBe('Fom');
    expect(repairAttempts).toBe(1);
  });

  it('throws SchemaValidationError on invalid shape', async () => {
    await expect(
      enforce('{"age":25}', { validator })
    ).rejects.toThrow(SchemaValidationError);
  });
});
