// ─── Core ─────────────────────────────────────────────────────────────────────
export { Guardian } from './core/Guardian.js';
export {
  GuardianError,
  SchemaValidationError,
  PIIError,
  InjectionError,
  BudgetError,
} from './core/errors.js';

// ─── Modules ──────────────────────────────────────────────────────────────────
export { detectPII, redactPII } from './modules/pii/index.js';
export { enforce, repairAndParse, cleanMarkdown, extractJSON, repairJSON } from './modules/schema/index.js';
export { detectInjection } from './modules/injection/index.js';
export { buildUsage, checkBudget, calculateCost, estimateTokens } from './modules/budget/index.js';
export { generateCanaryToken, injectCanary, checkCanaryLeak } from './modules/canary/index.js';
export { detectContent } from './modules/content/index.js';
export { detectHallucination, extractEntities } from './modules/hallucination/index.js';
export { RateLimiter } from './modules/ratelimit/index.js';
export { buildAuditEntry } from './modules/audit/index.js';

// ─── Adapters ─────────────────────────────────────────────────────────────────
export { guardVercelStream, createVercelGuard } from './adapters/vercel.js';
export { createGuardedParser, repairLangChainOutput } from './adapters/langchain.js';

// ─── Utils ────────────────────────────────────────────────────────────────────
export { collectStream } from './utils/stream.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  GuardianConfig,
  GuardianResult,
  GuardianMeta,
  PIIConfig,
  PIIMatch,
  PIIType,
  SchemaConfig,
  SchemaValidator,
  ZodLikeSchema,
  CustomValidator,
  InjectionConfig,
  InjectionMatch,
  InjectionSensitivity,
  BudgetConfig,
  BudgetUsage,
  SupportedModel,
  NormalizedResponse,
} from './types/index.js';

export type {
  InspectReport,
  InspectPromptReport,
  InspectOutputReport,
  RiskLevel,
} from './types/inspect.js';

export type {
  CanaryConfig,
} from './modules/canary/index.js';

export type {
  ContentConfig,
  ContentResult,
  ContentMatch,
  ContentCategory,
  ContentSensitivity,
} from './modules/content/index.js';

export type {
  HallucinationConfig,
  HallucinationResult,
} from './modules/hallucination/index.js';

export type {
  RateLimitConfig,
} from './modules/ratelimit/index.js';

export type {
  AuditEntry,
  AuditHandler,
} from './modules/audit/index.js';
