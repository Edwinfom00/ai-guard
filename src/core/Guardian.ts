import type {
  GuardianConfig,
  GuardianMeta,
  GuardianResult,
  NormalizedResponse,
  PIIType,
} from '../types/index.js';
import type { InspectReport } from '../types/inspect.js';
import type { Adapter } from '../adapters/base.js';
import { genericAdapter } from '../adapters/base.js';
import { redactPII } from '../modules/pii/redactor.js';
import { detectPII } from '../modules/pii/detector.js';
import { detectInjection } from '../modules/injection/detector.js';
import { enforce } from '../modules/schema/enforcer.js';
import { buildUsage, checkBudget } from '../modules/budget/sentinel.js';
import { collectStream } from '../utils/stream.js';
import { generateCanaryToken, injectCanary, checkCanaryLeak } from '../modules/canary/index.js';
import { detectContent } from '../modules/content/detector.js';
import { detectHallucination } from '../modules/hallucination/detector.js';
import { RateLimiter } from '../modules/ratelimit/index.js';
import { buildAuditEntry } from '../modules/audit/index.js';

const ALL_PII_TYPES: PIIType[] = [
  'email', 'phone', 'creditCard', 'ssn', 'ipAddress', 'iban', 'url',
  'nir', 'siret', 'siren', 'passport', 'dateOfBirth',
];

export class Guardian<T = unknown> {
  private readonly config: GuardianConfig<T>;
  private readonly adapter: Adapter;
  private readonly rateLimiter: RateLimiter | null;

  constructor(config: GuardianConfig<T> = {}, adapter?: Adapter) {
    this.config = config;
    this.adapter = adapter ?? genericAdapter;
    this.rateLimiter = config.rateLimit ? new RateLimiter(config.rateLimit) : null;
  }

  /**
   * Protects a standard (non-streaming) AI provider call.
   * Full pipeline: rate limit → PII (input) → injection → canary inject →
   * provider call → normalize → PII (output) → content policy →
   * hallucination → budget → schema → canary check → audit log
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
      canaryLeaked: false,
      contentViolation: false,
      hallucinationSuspected: false,
      hallucinationScore: 1,
    };

    // ── 0. Rate Limiting ──────────────────────────────────────────────────────
    this.rateLimiter?.check(prompt);

    // ── 1. INPUT: PII Redaction ───────────────────────────────────────────────
    let safePrompt = prompt;
    if (prompt && this.config.pii?.onInput !== false) {
      const { text, matches } = redactPII(prompt, this.config.pii);
      safePrompt = text;
      meta.piiRedacted.push(...matches);
    }

    // ── 2. INPUT: Injection Detection ─────────────────────────────────────────
    if (prompt && this.config.injection?.enabled) {
      const result = detectInjection(safePrompt, this.config.injection);
      meta.injectionDetected.push(...result.matches);
    }

    // ── 3. INPUT: Content Policy ──────────────────────────────────────────────
    if (prompt && this.config.content?.enabled) {
      const result = detectContent(safePrompt, this.config.content);
      if (result.detected) meta.contentViolation = true;
    }

    // ── 4. Canary Token Injection ─────────────────────────────────────────────
    let canaryToken: string | null = null;
    if (this.config.canary?.enabled) {
      canaryToken = generateCanaryToken(this.config.canary.prefix);
      safePrompt = injectCanary(safePrompt, canaryToken);
    }

    // ── 5. Provider Call ──────────────────────────────────────────────────────
    const rawProviderResponse = await callFn(safePrompt);

    // ── 6. Normalize via adapter ──────────────────────────────────────────────
    const normalized: NormalizedResponse = this.adapter(rawProviderResponse);

    // ── 7. OUTPUT: PII Redaction ──────────────────────────────────────────────
    let outputText = normalized.text;
    if (this.config.pii?.onOutput !== false && this.config.pii) {
      const { text, matches } = redactPII(outputText, this.config.pii);
      outputText = text;
      meta.piiRedacted.push(...matches);
    }

    // ── 8. OUTPUT: Content Policy ─────────────────────────────────────────────
    if (this.config.content?.enabled) {
      const result = detectContent(outputText, {
        ...this.config.content,
        throwOnDetection: false, // output violations are flagged, not thrown
      });
      if (result.detected) meta.contentViolation = true;
    }

    // ── 9. Canary Leak Check ──────────────────────────────────────────────────
    if (canaryToken && this.config.canary) {
      const canaryResult = checkCanaryLeak(outputText, canaryToken, this.config.canary);
      meta.canaryLeaked = canaryResult.leaked;
    }

    // ── 10. Hallucination Detection ───────────────────────────────────────────
    if (this.config.hallucination) {
      const result = detectHallucination(outputText, this.config.hallucination);
      meta.hallucinationSuspected = result.suspected;
      meta.hallucinationScore = result.groundingScore;
    }

    // ── 11. Budget Sentinel ───────────────────────────────────────────────────
    if (this.config.budget) {
      const usage = buildUsage(
        safePrompt, outputText,
        this.config.budget.model ?? 'unknown',
        normalized.inputTokens,
        normalized.outputTokens
      );
      checkBudget(usage, this.config.budget);
      meta.budget = usage;
      // Update rate limiter with real token count
      this.rateLimiter?.check(prompt, usage.totalTokens);
    }

    // ── 12. Schema Enforcement + Auto-Repair ──────────────────────────────────
    let data: T;
    if (this.config.schema) {
      const { data: validated, repairAttempts } = await enforce<T>(outputText, this.config.schema);
      data = validated;
      meta.repairAttempts = repairAttempts;
    } else {
      data = outputText as unknown as T;
    }

    meta.durationMs = Date.now() - start;

    // ── 13. Audit Log ─────────────────────────────────────────────────────────
    if (this.config.onAudit) {
      const entry = buildAuditEntry(prompt, outputText, meta, {
        contentViolation: meta.contentViolation,
        hallucinationSuspected: meta.hallucinationSuspected,
        hallucinationScore: meta.hallucinationScore,
      });
      void Promise.resolve(this.config.onAudit(entry)).catch(() => {});
    }

    return { data, raw: outputText, meta };
  }

  /**
   * Protects a streaming AI provider call.
   * Collects the full stream first, then applies the complete pipeline.
   */
  async protectStream(
    callFn: (safePrompt: string) => Promise<unknown>,
    prompt = ''
  ): Promise<GuardianResult<T>> {
    return this.protect(async (safePrompt) => {
      const streamResult = await callFn(safePrompt);
      return await collectStream(streamResult);
    }, prompt);
  }

  /**
   * Dry-run analysis mode — full scan without blocking or throwing.
   * Returns a detailed risk report. Useful for logging and monitoring.
   */
  async inspect(prompt: string, rawOutput?: string): Promise<InspectReport> {
    const summary: string[] = [];

    // Prompt PII
    const promptPII = detectPII(prompt, this.config.pii?.targets ?? ALL_PII_TYPES);
    if (promptPII.length > 0) {
      summary.push(`Prompt PII: ${[...new Set(promptPII.map((m) => m.type))].join(', ')}`);
    }

    // Prompt Injection
    const injectionConfig = this.config.injection ?? { enabled: true, sensitivity: 'medium' };
    const injectionResult = detectInjection(prompt, { ...injectionConfig, throwOnDetection: false });
    if (injectionResult.detected) {
      summary.push(`Prompt injection detected (score: ${injectionResult.score.toFixed(2)})`);
    }

    // Prompt Content Policy
    const contentConfig = this.config.content ?? { enabled: true, sensitivity: 'medium' };
    const contentResult = detectContent(prompt, { ...contentConfig, throwOnDetection: false });
    if (contentResult.detected) {
      summary.push(`Content violation: ${contentResult.categories.join(', ')}`);
    }

    // Output analysis
    let outputReport: InspectReport['output'] = null;
    if (rawOutput !== undefined) {
      const outputPII = detectPII(rawOutput, this.config.pii?.targets ?? ALL_PII_TYPES);
      if (outputPII.length > 0) {
        summary.push(`Output PII: ${[...new Set(outputPII.map((m) => m.type))].join(', ')}`);
      }

      let schemaValid = true;
      let schemaError: unknown;
      let repairAttempts = 0;
      if (this.config.schema) {
        try {
          const r = await enforce<T>(rawOutput, this.config.schema);
          repairAttempts = r.repairAttempts;
          if (repairAttempts > 0) summary.push(`Schema repaired (${repairAttempts} attempt(s))`);
        } catch (err) {
          schemaValid = false;
          schemaError = err;
          summary.push('Schema validation failed — output is malformed');
        }
      }

      outputReport = { pii: outputPII, schemaValid, schemaError, repairAttempts };
    }

    // Budget
    let budgetReport: InspectReport['budget'] = null;
    if (this.config.budget && rawOutput !== undefined) {
      budgetReport = buildUsage(prompt, rawOutput, this.config.budget.model ?? 'unknown');
      const pct = this.config.budget.maxCostUSD
        ? budgetReport.estimatedCostUSD / this.config.budget.maxCostUSD : 0;
      if (pct > 0.8) summary.push(`Budget at ${Math.round(pct * 100)}% of limit`);
    }

    const overallRisk = computeRisk(injectionResult.score, promptPII, contentResult, outputReport);
    if (summary.length === 0) summary.push('No issues detected');

    return {
      prompt: { pii: promptPII, injection: injectionResult },
      output: outputReport,
      budget: budgetReport,
      overallRisk,
      summary,
    };
  }
}

function computeRisk(
  injectionScore: number,
  promptPII: unknown[],
  content: { detected: boolean; score: number },
  output: InspectReport['output']
): InspectReport['overallRisk'] {
  if (injectionScore >= 0.9 || content.score >= 0.9) return 'critical';
  if (injectionScore >= 0.75 || content.detected) return 'high';
  if (promptPII.length > 0 && injectionScore >= 0.5) return 'high';
  if (promptPII.length > 0 || (output && !output.schemaValid)) return 'medium';
  if (output && output.pii.length > 0) return 'medium';
  if (injectionScore >= 0.5) return 'low';
  if (output && output.repairAttempts > 0) return 'low';
  return 'safe';
}
