// Core
export { Guardian } from './core/Guardian.js';
export {
  GuardianError,
  SchemaValidationError,
  PIIError,
  InjectionError,
  BudgetError,
} from './core/errors.js';

// Modules (also importable via sub-paths: @edwinfom/ai-guard/pii, etc.)
export { detectPII, redactPII } from './modules/pii/index.js';
export { enforce, repairAndParse, cleanMarkdown, extractJSON } from './modules/schema/index.js';
export { detectInjection } from './modules/injection/index.js';
export { buildUsage, checkBudget, calculateCost, estimateTokens } from './modules/budget/index.js';

// Types
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
