import type { BudgetConfig, BudgetUsage, SupportedModel, KnownModel } from '../../types/index.js';
import { BudgetError } from '../../core/errors.js';
import { estimateTokens } from './tokenizer.js';

/**
 * Cost per 1M tokens in USD (input / output).
 * Source: official pricing pages — update as needed.
 */
const MODEL_PRICING: Record<KnownModel, { input: number; output: number }> = {
  'gpt-4o':                        { input: 2.50,   output: 10.00  },
  'gpt-4o-mini':                   { input: 0.15,   output: 0.60   },
  'gpt-4.1':                       { input: 2.00,   output: 8.00   },
  'gpt-4.1-mini':                  { input: 0.40,   output: 1.60   },
  'gpt-4-turbo':                   { input: 10.00,  output: 30.00  },
  'gpt-3.5-turbo':                 { input: 0.50,   output: 1.50   },
  'claude-3-7-sonnet-20250219':    { input: 3.00,   output: 15.00  },
  'claude-3-5-sonnet-20241022':    { input: 3.00,   output: 15.00  },
  'claude-3-5-haiku-20241022':     { input: 0.80,   output: 4.00   },
  'claude-3-opus-20240229':        { input: 15.00,  output: 75.00  },
  'gemini-2.5-pro':                { input: 1.25,   output: 10.00  },
  'gemini-2.0-flash':              { input: 0.10,   output: 0.40   },
  'gemini-1.5-pro':                { input: 1.25,   output: 5.00   },
  'gemini-1.5-flash':              { input: 0.075,  output: 0.30   },
  'mistral-large-2411':            { input: 2.00,   output: 6.00   },
  'llama-3.3-70b':                 { input: 0.59,   output: 0.79   },
};

/**
 * Custom model pricing registry — users can register their own models.
 * Stored on globalThis to survive across module instances (CJS/ESM dual builds).
 * @example
 * registerModelPricing('my-fine-tuned-model', { input: 1.00, output: 2.00 });
 */
const GLOBAL_KEY = '__ai_guard_custom_pricing__';

function getCustomPricing(): Map<string, { input: number; output: number }> {
  const g = globalThis as Record<string, unknown>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map<string, { input: number; output: number }>();
  }
  return g[GLOBAL_KEY] as Map<string, { input: number; output: number }>;
}

export function registerModelPricing(
  model: string,
  pricing: { input: number; output: number }
): void {
  getCustomPricing().set(model, pricing);
}

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: SupportedModel | 'unknown'
): number {
  if (model === 'unknown') return 0;
  const pricing = (MODEL_PRICING as Record<string, { input: number; output: number }>)[model]
    ?? getCustomPricing().get(model);
  if (!pricing) return 0;

  return (inputTokens / 1_000_000) * pricing.input
       + (outputTokens / 1_000_000) * pricing.output;
}

/**
 * Builds a BudgetUsage object from token counts (real or estimated).
 */
export function buildUsage(
  inputText: string,
  outputText: string,
  model: SupportedModel | 'unknown',
  realInputTokens?: number,
  realOutputTokens?: number
): BudgetUsage {
  const inputTokens  = realInputTokens  ?? estimateTokens(inputText);
  const outputTokens = realOutputTokens ?? estimateTokens(outputText);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostUSD: calculateCost(inputTokens, outputTokens, model),
    model,
  };
}

/**
 * Checks usage against configured limits.
 * Fires onWarning at >80% of the limit.
 * Throws BudgetError if the limit is exceeded.
 */
export function checkBudget(usage: BudgetUsage, config: BudgetConfig): void {
  const { maxTokens, maxCostUSD, onWarning, model = 'unknown' } = config;

  if (maxTokens !== undefined) {
    const pct = usage.totalTokens / maxTokens;
    if (pct > 0.8 && pct <= 1.0) {
      onWarning?.(usage);
    }
    if (usage.totalTokens > maxTokens) {
      throw new BudgetError('tokens', usage.totalTokens, maxTokens, model);
    }
  }

  if (maxCostUSD !== undefined) {
    const pct = usage.estimatedCostUSD / maxCostUSD;
    if (pct > 0.8 && pct <= 1.0) {
      onWarning?.(usage);
    }
    if (usage.estimatedCostUSD > maxCostUSD) {
      throw new BudgetError('cost', usage.estimatedCostUSD, maxCostUSD, model);
    }
  }
}
