import type { NormalizedResponse } from '../types/index.js';
import { GuardianError } from '../core/errors.js';

/**
 * Each adapter takes the raw provider response and extracts:
 * - text: the string content
 * - inputTokens / outputTokens: real token counts when available
 */
export type Adapter = (raw: unknown) => NormalizedResponse;

/**
 * Generic fallback adapter — tries common response shapes.
 * Covers most providers without a dedicated adapter.
 */
export const genericAdapter: Adapter = (raw): NormalizedResponse => {
  if (typeof raw === 'string') {
    return { text: raw };
  }

  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;

    // OpenAI-style
    if (Array.isArray(obj['choices'])) {
      const choice = (obj['choices'] as Array<Record<string, unknown>>)[0];
      const message = choice?.['message'] as Record<string, unknown> | undefined;
      const text = (message?.['content'] as string | undefined)
        ?? (choice?.['text'] as string | undefined)
        ?? '';
      const usage = obj['usage'] as Record<string, number> | undefined;
      return {
        text,
        ...(usage?.['prompt_tokens'] !== undefined && { inputTokens: usage['prompt_tokens'] }),
        ...(usage?.['completion_tokens'] !== undefined && { outputTokens: usage['completion_tokens'] }),
      };
    }

    // Anthropic-style
    if (Array.isArray(obj['content'])) {
      const blocks = obj['content'] as Array<Record<string, unknown>>;
      const text = blocks
        .filter((b) => b['type'] === 'text')
        .map((b) => b['text'] as string)
        .join('');
      const usage = obj['usage'] as Record<string, number> | undefined;
      return {
        text,
        ...(usage?.['input_tokens'] !== undefined && { inputTokens: usage['input_tokens'] }),
        ...(usage?.['output_tokens'] !== undefined && { outputTokens: usage['output_tokens'] }),
      };
    }

    // Gemini-style
    if (Array.isArray(obj['candidates'])) {
      const candidate = (obj['candidates'] as Array<Record<string, unknown>>)[0];
      const content = candidate?.['content'] as Record<string, unknown> | undefined;
      const parts = content?.['parts'] as Array<Record<string, unknown>> | undefined;
      const text = parts?.map((p) => p['text'] as string).join('') ?? '';
      const meta = obj['usageMetadata'] as Record<string, number> | undefined;
      return {
        text,
        ...(meta?.['promptTokenCount'] !== undefined && { inputTokens: meta['promptTokenCount'] }),
        ...(meta?.['candidatesTokenCount'] !== undefined && { outputTokens: meta['candidatesTokenCount'] }),
      };
    }

    // Plain text field
    if (typeof obj['text'] === 'string') return { text: obj['text'] };
    if (typeof obj['content'] === 'string') return { text: obj['content'] };
    if (typeof obj['response'] === 'string') return { text: obj['response'] };
  }

  throw new GuardianError(
    'ADAPTER_PARSE_FAILED',
    'Could not extract text from provider response. Use a custom adapter.',
    { raw }
  );
};
