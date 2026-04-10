import type {
  GuardianConfig,
  GuardianMeta,
  GuardianResult,
  NormalizedResponse,
} from '../types/index.js';
import type { Adapter } from '../adapters/base.js';
import { genericAdapter } from '../adapters/base.js';
import { redactPII } from '../modules/pii/redactor.js';
import { detectInjection } from '../modules/injection/detector.js';
import { enforce } from '../modules/schema/enforcer.js';
import { buildUsage, checkBudget } from '../modules/budget/sentinel.js';

export class Guardian<T = unknown> {
  private readonly config: GuardianConfig<T>;
  private readonly adapter: Adapter;

  constructor(config: GuardianConfig<T> = {}, adapter?: Adapter) {
    this.config = config;
    this.adapter = adapter ?? genericAdapter;
  }

  /**
   * Main entry point.
   *
   * @param callFn   An async function that calls your AI provider and returns its raw response.
   * @param prompt   The original user prompt (used for PII redaction + injection check on input).
   *
   * @example
   * const result = await guard.protect(
   *   (safePrompt) => openai.chat.completions.create({ messages: [{ role: 'user', content: safePrompt }] }),
   *   userPrompt
   * );
   */
  async protect(
    callFn: (safePrompt: string) => Promise<unknown>,
    prompt = ''
  ): Promise<GuardianResult<T>> {
    const start = Date.now();
    const meta: GuardianMeta = {
      piiRedacted: [],
      injectionDetected: [],
      budget: null,
      repairAttempts: 0,
      durationMs: 0,
    };

    // ── 1. INPUT: PII Redaction ───────────────────────────────────────────────
    let safePrompt = prompt;
    if (prompt && this.config.pii?.onInput !== false) {
      const { text, matches } = redactPII(prompt, this.config.pii);
      safePrompt = text;
      meta.piiRedacted.push(...matches);
    }

    // ── 2. INPUT: Injection Detection ────────────────────────────────────────
    if (prompt && this.config.injection?.enabled) {
      const result = detectInjection(safePrompt, this.config.injection);
      meta.injectionDetected.push(...result.matches);
    }

    // ── 3. Call the provider ─────────────────────────────────────────────────
    const rawProviderResponse = await callFn(safePrompt);

    // ── 4. Normalize response via adapter ─────────────────────────────────────
    const normalized: NormalizedResponse = this.adapter(rawProviderResponse);

    // ── 5. OUTPUT: PII Redaction ──────────────────────────────────────────────
    let outputText = normalized.text;
    if (this.config.pii?.onOutput !== false && this.config.pii) {
      const { text, matches } = redactPII(outputText, this.config.pii);
      outputText = text;
      meta.piiRedacted.push(...matches);
    }

    // ── 6. Budget Sentinel ────────────────────────────────────────────────────
    if (this.config.budget) {
      const usage = buildUsage(
        safePrompt,
        outputText,
        this.config.budget.model ?? 'unknown',
        normalized.inputTokens,
        normalized.outputTokens
      );
      checkBudget(usage, this.config.budget);
      meta.budget = usage;
    }

    // ── 7. Schema Enforcement + Auto-Repair ───────────────────────────────────
    let data: T;
    if (this.config.schema) {
      const { data: validated, repairAttempts } = await enforce<T>(outputText, this.config.schema);
      data = validated;
      meta.repairAttempts = repairAttempts;
    } else {
      data = outputText as unknown as T;
    }

    meta.durationMs = Date.now() - start;

    return { data, raw: outputText, meta };
  }
}
