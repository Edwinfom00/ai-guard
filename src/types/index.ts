// ─── Zod optional peer dependency ────────────────────────────────────────────

// We don't import Zod directly — we accept its schema type via duck typing
// so users without Zod can still use a custom validator function.
export type ZodLikeSchema<T = unknown> = {
  parse: (data: unknown) => T;
  safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: unknown };
};

export type CustomValidator<T = unknown> = (data: unknown) =>
  | { success: true; data: T }
  | { success: false; error: string };

export type SchemaValidator<T = unknown> = ZodLikeSchema<T> | CustomValidator<T>;

// ─── PII ──────────────────────────────────────────────────────────────────────

export type PIIType =
  | 'email'
  | 'phone'
  | 'creditCard'
  | 'ssn'
  | 'ipAddress'
  | 'url'
  | 'iban'
  // International
  | 'nir'
  | 'siret'
  | 'siren'
  | 'passport'
  | 'dateOfBirth';

export interface PIIMatch {
  type: PIIType;
  value: string;
  start: number;
  end: number;
  redactedWith: string;
}

export interface PIIConfig {
  /** Types of PII to detect and redact. Defaults to all. */
  targets?: PIIType[];
  /** Replace detected PII with a token. Default: "[REDACTED:<TYPE>]" */
  replaceWith?: (type: PIIType) => string;
  /** Apply PII redaction on input prompt. Default: true */
  onInput?: boolean;
  /** Apply PII redaction on output response. Default: true */
  onOutput?: boolean;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface SchemaConfig<T = unknown> {
  /** A Zod schema or custom validator function */
  validator: SchemaValidator<T>;
  /**
   * Auto-repair strategy when raw output is not valid JSON.
   * - 'clean'  : strip markdown fences, trim whitespace (Level 1)
   * - 'extract': regex-extract first valid JSON object/array (Level 2)
   * - 'retry'  : re-ask the LLM to fix the output (Level 3, requires retryFn)
   */
  repair?: 'clean' | 'extract' | 'retry';
  /**
   * Required when repair = 'retry'.
   * Called with a correction prompt, must return the new raw string from the LLM.
   */
  retryFn?: (correctionPrompt: string) => Promise<string>;
  /** Max retry attempts. Default: 1 */
  maxRetries?: number;
}

// ─── Injection ────────────────────────────────────────────────────────────────

export type InjectionSensitivity = 'low' | 'medium' | 'high';

export interface InjectionConfig {
  enabled: boolean;
  sensitivity?: InjectionSensitivity;
  /** Custom patterns to add to the built-in library */
  customPatterns?: RegExp[];
  /** Throw an error when injection is detected. Default: true */
  throwOnDetection?: boolean;
}

export interface InjectionMatch {
  pattern: string;
  matchedText: string;
  score: number;
}

// ─── Budget ───────────────────────────────────────────────────────────────────

export type KnownModel =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4.1'
  | 'gpt-4.1-mini'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'claude-3-7-sonnet-20250219'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-haiku-20241022'
  | 'claude-3-opus-20240229'
  | 'gemini-2.5-pro'
  | 'gemini-2.0-flash'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'
  | 'mistral-large-2411'
  | 'llama-3.3-70b';

/**
 * Accepts any known model name (with autocomplete) OR any custom string.
 * e.g. 'gpt-4o', 'my-fine-tuned-model', 'ollama/llama3', etc.
 */
export type SupportedModel = KnownModel | (string & {});

export interface BudgetConfig {
  /** Maximum tokens allowed (input + output). Throws if exceeded. */
  maxTokens?: number;
  /** Maximum cost in USD. Throws if estimated cost exceeds this. */
  maxCostUSD?: number;
  /** The model to use for cost estimation. */
  model?: SupportedModel;
  /** Callback fired when budget is close to limit (>80%). */
  onWarning?: (usage: BudgetUsage) => void;
}

export interface BudgetUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
  model: SupportedModel | 'unknown';
}

// ─── Guardian Core ────────────────────────────────────────────────────────────

export interface GuardianConfig<T = unknown> {
  pii?: PIIConfig;
  schema?: SchemaConfig<T>;
  injection?: InjectionConfig;
  budget?: BudgetConfig;
  /** Canary token — detect system prompt leakage */
  canary?: import('../modules/canary/index.js').CanaryConfig;
  /** Content policy — toxicity, hate, violence, self-harm */
  content?: import('../modules/content/detector.js').ContentConfig;
  /** Hallucination detection against RAG source documents */
  hallucination?: import('../modules/hallucination/detector.js').HallucinationConfig;
  /** Per-user / per-key rate limiting */
  rateLimit?: import('../modules/ratelimit/index.js').RateLimitConfig;
  /** Audit log callback — called after every protect() */
  onAudit?: import('../modules/audit/index.js').AuditHandler;
}

export interface GuardianMeta {
  piiRedacted: PIIMatch[];
  injectionDetected: InjectionMatch[];
  budget: BudgetUsage | null;
  repairAttempts: number;
  durationMs: number;
  /** Canary token leak detected */
  canaryLeaked: boolean;
  /** Content policy violation detected */
  contentViolation: boolean;
  /** Hallucination suspected */
  hallucinationSuspected: boolean;
  hallucinationScore: number;
}

export interface GuardianResult<T> {
  data: T;
  raw: string;
  meta: GuardianMeta;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export interface NormalizedResponse {
  /** The text content of the response */
  text: string;
  /** Total input tokens used (if available from provider) */
  inputTokens?: number;
  /** Total output tokens used (if available from provider) */
  outputTokens?: number;
}

export type ProviderCallFn = () => Promise<unknown>;
