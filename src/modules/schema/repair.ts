import { GuardianError } from '../../core/errors.js';

/**
 * LEVEL 1 — Clean markdown fences and whitespace.
 * Handles: ```json ... ```, ```...```, leading/trailing text.
 */
export function cleanMarkdown(raw: string): string {
  let text = raw.trim();

  // Strip ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch?.[1] !== undefined) {
    text = fenceMatch[1].trim();
  }

  // Strip single backtick wrappers
  if (text.startsWith('`') && text.endsWith('`')) {
    text = text.slice(1, -1).trim();
  }

  return text;
}

/**
 * LEVEL 2 — Extract first valid JSON object or array from arbitrary text.
 * Handles: "Here is your result: { ... } Hope that helps!"
 */
export function extractJSON(raw: string): string | null {
  // Try to find the first { or [ and match its closing bracket
  const startObj = raw.indexOf('{');
  const startArr = raw.indexOf('[');

  let start: number;
  let openChar: '{' | '[';
  let closeChar: '}' | ']';

  if (startObj === -1 && startArr === -1) return null;

  if (startObj === -1) {
    start = startArr;
    openChar = '[';
    closeChar = ']';
  } else if (startArr === -1) {
    start = startObj;
    openChar = '{';
    closeChar = '}';
  } else {
    // Use whichever comes first
    if (startObj < startArr) {
      start = startObj;
      openChar = '{';
      closeChar = '}';
    } else {
      start = startArr;
      openChar = '[';
      closeChar = ']';
    }
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < raw.length; i++) {
    const char = raw[i];
    if (char === undefined) continue;

    if (escape) { escape = false; continue; }
    if (char === '\\' && inString) { escape = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (char === openChar) depth++;
    if (char === closeChar) {
      depth--;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }

  return null;
}

/**
 * LEVEL 3 — Ask the LLM to return corrected JSON.
 * Sends a correction prompt to the retryFn provided in config.
 */
export async function retryWithLLM(
  raw: string,
  schemaDescription: string,
  retryFn: (prompt: string) => Promise<string>
): Promise<string> {
  const correctionPrompt = [
    'The following text is supposed to be valid JSON but it is malformed.',
    'Return ONLY the corrected JSON object with no explanation, no markdown, no extra text.',
    '',
    `Expected schema: ${schemaDescription}`,
    '',
    'Malformed input:',
    raw,
  ].join('\n');

  const result = await retryFn(correctionPrompt);
  return result.trim();
}

/**
 * Attempts to parse a string as JSON using the 3-level repair pipeline.
 * Returns the parsed value or throws a GuardianError.
 */
export async function repairAndParse(
  raw: string,
  options: {
    repair: 'clean' | 'extract' | 'retry';
    retryFn?: (prompt: string) => Promise<string>;
    schemaDescription?: string;
    maxRetries?: number;
  }
): Promise<unknown> {
  const { repair, retryFn, schemaDescription = 'unknown', maxRetries = 1 } = options;

  // Always try a direct parse first (no repair needed)
  try {
    return JSON.parse(raw);
  } catch {
    // Fall through to repair levels
  }

  // Level 1: Clean markdown
  const cleaned = cleanMarkdown(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    if (repair === 'clean') {
      throw new GuardianError(
        'SCHEMA_REPAIR_FAILED',
        'JSON parsing failed after Level 1 (markdown cleanup).',
        { raw }
      );
    }
  }

  // Level 2: Extract JSON substring
  const extracted = extractJSON(cleaned);
  if (extracted !== null) {
    try {
      return JSON.parse(extracted);
    } catch {
      // Fall through
    }
  }

  if (repair === 'extract' || !retryFn) {
    throw new GuardianError(
      'SCHEMA_REPAIR_FAILED',
      'JSON parsing failed after Level 2 (JSON extraction).',
      { raw }
    );
  }

  // Level 3: LLM retry
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const retried = await retryWithLLM(cleaned, schemaDescription, retryFn);
      const extracted2 = extractJSON(retried) ?? retried;
      return JSON.parse(extracted2);
    } catch (err) {
      lastError = err;
    }
  }

  throw new GuardianError(
    'RETRY_LIMIT_EXCEEDED',
    `JSON repair failed after ${maxRetries} LLM retry attempt(s).`,
    { raw, lastError }
  );
}
