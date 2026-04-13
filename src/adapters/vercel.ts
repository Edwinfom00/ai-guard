import { Guardian } from '../core/Guardian.js';
import type { GuardianConfig, GuardianResult } from '../types/index.js';
import { collectStream } from '../utils/stream.js';

/**
 * Vercel AI SDK — streamText result shape (duck-typed, no hard import).
 * Compatible with `streamText()` from the `ai` package.
 */
export interface VercelStreamTextResult {
  /** Promise resolving to the full text — most efficient collection method */
  text: Promise<string>;
  /** AsyncIterable of text chunks — fallback */
  textStream?: AsyncIterable<string>;
  usage?: Promise<{ promptTokens: number; completionTokens: number }>;
}

/**
 * Wraps a Vercel AI SDK `streamText()` call with Guardian protection.
 *
 * @example
 * ```typescript
 * import { streamText } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 * import { Guardian } from '@edwinfom/ai-guard';
 * import { guardVercelStream } from '@edwinfom/ai-guard/adapters/vercel';
 *
 * const guard = new Guardian({ pii: { onInput: true }, injection: { enabled: true } });
 *
 * const result = await guardVercelStream(
 *   guard,
 *   (safePrompt) => streamText({ model: openai('gpt-4o-mini'), prompt: safePrompt }),
 *   userPrompt
 * );
 *
 * console.log(result.data);       // Full text, PII redacted
 * console.log(result.meta.budget); // Token/cost info if budget configured
 * ```
 */
export async function guardVercelStream<T = string>(
  guard: Guardian<T>,
  callFn: (safePrompt: string) => VercelStreamTextResult | Promise<VercelStreamTextResult>,
  prompt = ''
): Promise<GuardianResult<T>> {
  return guard.protect(async (safePrompt) => {
    const streamResult = await callFn(safePrompt);

    // Collect full text from the Vercel stream
    const text = await streamResult.text;

    // Resolve usage if available for accurate budget tracking
    const usage = streamResult.usage ? await streamResult.usage : undefined;

    return {
      choices: [{ message: { content: text } }],
      ...(usage && {
        usage: {
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
        },
      }),
    };
  }, prompt);
}

/**
 * Creates a pre-configured Guardian wrapper for Vercel AI SDK.
 * Useful when you want to reuse the same guard across multiple calls.
 *
 * @example
 * ```typescript
 * const guardedAI = createVercelGuard({ injection: { enabled: true } });
 * const result = await guardedAI(() => streamText({ model, prompt }), userPrompt);
 * ```
 */
export function createVercelGuard<T = string>(
  config: GuardianConfig<T>
): (
  callFn: (safePrompt: string) => VercelStreamTextResult | Promise<VercelStreamTextResult>,
  prompt?: string
) => Promise<GuardianResult<T>> {
  const guard = new Guardian<T>(config);
  return (callFn, prompt = '') => guardVercelStream(guard, callFn, prompt);
}

export { collectStream };
