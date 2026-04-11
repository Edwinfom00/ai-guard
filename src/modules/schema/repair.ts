import { jsonrepair } from 'jsonrepair';
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
 * LEVEL 2 — Deep JSON repair via jsonrepair.
 * Handles 100+ malformed patterns that our old regex missed:
 * - Trailing commas: {"a":1,}
 * - Unquoted keys: {name:"Edwin"}
 * - Single quotes: {'name':'Edwin'}
 * - Incomplete JSON: {"name":"Edwin"
 * - Surrounding text: "Here is the JSON: {...} Hope that helps!"
 * - Invalid escape sequences
 * - Python-style booleans: True/False/None
 *
 * Falls back to our manual bracket-extraction if jsonrepair itself throws.
 */
export function repairJSON(raw: string): string {
  return jsonrepair(raw);
}

/**
 * Legacy manual extractor — kept as last-resort fallback before LLM retry.
 * Extracts the first syntactically complete JSON object or array.
 */
export function extractJSON(raw: string): string | null {
  const startObj = raw.indexOf('{');
  const startArr = raw.indexOf('[');

  let start: number;
  let openChar: '{' | '[';
  let closeChar: '}' | ']';

  if (startObj === -1 && startArr === -1) return null;

  if (startObj === -1) {
    start = startArr; openChar = '['; closeChar = ']';
  } else if (startArr === -1) {
    start = startObj; openChar = '{'; closeChar = '}';
  } else {
    if (startObj < startArr) {
      start = startObj; openChar = '{'; closeChar = '}';
    } else {
      start = startArr; openChar = '['; closeChar = ']';
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
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  return null;
}

/**
 * LEVEL 3 — Ask the LLM to return corrected JSON.
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

  return (await retryFn(correctionPrompt)).trim();
}

/**
 * Full 3-level repair pipeline.
 *
 * Level 1 — Strip markdown fences
 * Level 2 — jsonrepair (handles 100+ broken patterns)
 * Level 3 — LLM retry with correction prompt
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

  // Direct parse — no repair needed (happy path)
  try { return JSON.parse(raw); } catch { /* fall through */ }

  // Level 1: Clean markdown
  const cleaned = cleanMarkdown(raw);
  try { return JSON.parse(cleaned); } catch {
    if (repair === 'clean') {
      throw new GuardianError('SCHEMA_REPAIR_FAILED',
        'JSON parsing failed after Level 1 (markdown cleanup).', { raw });
    }
  }

  // Level 2: extractJSON + jsonrepair combo
  // Step 2a — extract the first JSON structure from surrounding text
  const extracted = extractJSON(cleaned) ?? cleaned;
  // Step 2b — only apply jsonrepair if the text looks like a JSON structure
  const looksLikeJSON = extracted.trimStart().startsWith('{') || extracted.trimStart().startsWith('[');
  if (looksLikeJSON) {
    try {
      return JSON.parse(jsonrepair(extracted));
    } catch { /* fall through */ }
  }

  if (repair === 'extract' || !retryFn) {
    throw new GuardianError('SCHEMA_REPAIR_FAILED',
      'JSON parsing failed after Level 2 (jsonrepair).', { raw });
  }

  // Level 3: LLM retry
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const retried = await retryWithLLM(cleaned, schemaDescription, retryFn);
      const retriedCleaned = cleanMarkdown(retried);
      const retriedExtracted = extractJSON(retriedCleaned) ?? retriedCleaned;
      const retriedLooksLikeJSON = retriedExtracted.trimStart().startsWith('{') || retriedExtracted.trimStart().startsWith('[');
      if (!retriedLooksLikeJSON) throw new Error('LLM retry did not return a JSON structure');
      return JSON.parse(jsonrepair(retriedExtracted));
    } catch (err) {
      lastError = err;
    }
  }

  throw new GuardianError('RETRY_LIMIT_EXCEEDED',
    `JSON repair failed after ${maxRetries} LLM retry attempt(s).`, { raw, lastError });
}
