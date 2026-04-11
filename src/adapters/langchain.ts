import type { SchemaConfig } from '../types/index.js';
import { enforce } from '../modules/schema/enforcer.js';
import { redactPII } from '../modules/pii/redactor.js';
import type { PIIConfig } from '../types/index.js';

/**
 * LangChain-compatible output parser interface (duck-typed).
 * Matches LangChain's `BaseOutputParser<T>` without requiring the dependency.
 */
export interface LangChainOutputParser<T> {
  parse(text: string): Promise<T>;
  getFormatInstructions?(): string;
}

/**
 * Wraps any LangChain OutputParser with Guardian's 3-level repair pipeline.
 * Solves the #1 LangChain issue: JSON parsing failures in structured output chains.
 *
 * @example
 * ```typescript
 * import { StructuredOutputParser } from 'langchain/output_parsers';
 * import { createGuardedParser } from '@edwinfom/ai-guard/adapters/langchain';
 * import { z } from 'zod';
 *
 * const baseParser = StructuredOutputParser.fromZodSchema(
 *   z.object({ name: z.string(), score: z.number() })
 * );
 *
 * const safeParser = createGuardedParser(baseParser, {
 *   validator: (data) => {
 *     const d = data as { name: string; score: number };
 *     if (typeof d.name === 'string') return { success: true, data: d };
 *     return { success: false, error: 'invalid' };
 *   },
 *   repair: 'retry',
 *   retryFn: async (prompt) => await llm.invoke(prompt),
 * });
 *
 * // Use safeParser anywhere LangChain expects a parser
 * const result = await safeParser.parse(llmOutput);
 * ```
 */
export function createGuardedParser<T>(
  baseParser: LangChainOutputParser<T>,
  schemaConfig: SchemaConfig<T>,
  piiConfig?: PIIConfig
): LangChainOutputParser<T> {
  return {
    async parse(text: string): Promise<T> {
      // Apply PII redaction on output before parsing
      let safeText = text;
      if (piiConfig) {
        const { text: redacted } = redactPII(text, piiConfig);
        safeText = redacted;
      }

      // Try base parser first (fastest path)
      try {
        return await baseParser.parse(safeText);
      } catch {
        // Base parser failed — use Guardian's repair pipeline
        const { data } = await enforce<T>(safeText, schemaConfig);
        return data;
      }
    },

    getFormatInstructions(): string {
      return baseParser.getFormatInstructions?.() ?? '';
    },
  };
}

/**
 * Standalone repair utility for LangChain — use when you don't have a base parser.
 *
 * @example
 * ```typescript
 * import { repairLangChainOutput } from '@edwinfom/ai-guard/adapters/langchain';
 *
 * const chain = prompt | llm | repairLangChainOutput(mySchema);
 * ```
 */
export function repairLangChainOutput<T>(
  schemaConfig: SchemaConfig<T>
): LangChainOutputParser<T> {
  return {
    async parse(text: string): Promise<T> {
      const { data } = await enforce<T>(text, schemaConfig);
      return data;
    },
    getFormatInstructions(): string {
      return 'Respond with valid JSON matching the required schema. No markdown, no extra text.';
    },
  };
}
