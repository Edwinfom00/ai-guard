import type { SchemaConfig } from '../../types/index.js';
import { SchemaValidationError } from '../../core/errors.js';
import { repairAndParse } from './repair.js';

function isZodSchema(v: unknown): v is { parse: (d: unknown) => unknown; safeParse: (d: unknown) => { success: boolean; data?: unknown; error?: unknown } } {
  return typeof v === 'object' && v !== null && typeof (v as Record<string, unknown>)['safeParse'] === 'function';
}

/**
 * Parses and validates raw LLM output against a schema.
 * Applies the repair pipeline if parsing fails.
 */
export async function enforce<T>(
  raw: string,
  config: SchemaConfig<T>
): Promise<{ data: T; repairAttempts: number }> {
  const { validator, repair = 'extract', retryFn, maxRetries = 1 } = config;

  let parsed: unknown;
  let repairAttempts = 0;

  try {
    parsed = JSON.parse(raw);
  } catch {
    repairAttempts++;
    parsed = await repairAndParse(raw, {
      repair,
      ...(retryFn !== undefined && { retryFn }),
      schemaDescription: isZodSchema(validator) ? String(validator) : 'custom schema',
      maxRetries,
    });
  }

  // Validate against schema
  if (isZodSchema(validator)) {
    const result = validator.safeParse(parsed);
    if (!result.success) {
      throw new SchemaValidationError(raw, result.error, repairAttempts);
    }
    return { data: result.data as T, repairAttempts };
  }

  // Custom validator function
  const result = (validator as (d: unknown) => { success: boolean; data?: T; error?: string })(parsed);
  if (!result.success) {
    throw new SchemaValidationError(raw, result.error, repairAttempts);
  }

  return { data: result.data as T, repairAttempts };
}
