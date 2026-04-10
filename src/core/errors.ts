import type { InjectionMatch, PIIMatch } from '../types/index.js';

export type GuardianErrorCode =
  | 'SCHEMA_VALIDATION_FAILED'
  | 'SCHEMA_REPAIR_FAILED'
  | 'PII_DETECTED_IN_INPUT'
  | 'PII_DETECTED_IN_OUTPUT'
  | 'PROMPT_INJECTION_DETECTED'
  | 'BUDGET_EXCEEDED'
  | 'ADAPTER_PARSE_FAILED'
  | 'RETRY_LIMIT_EXCEEDED';

export class GuardianError extends Error {
  readonly code: GuardianErrorCode;
  readonly context: Record<string, unknown>;

  constructor(code: GuardianErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'GuardianError';
    this.code = code;
    this.context = context;

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GuardianError);
    }
  }
}

export class SchemaValidationError extends GuardianError {
  readonly rawOutput: string;
  readonly validationError: unknown;

  constructor(rawOutput: string, validationError: unknown, repairAttempts: number) {
    super(
      'SCHEMA_REPAIR_FAILED',
      `Schema validation failed after ${repairAttempts} repair attempt(s).`,
      { repairAttempts, validationError }
    );
    this.name = 'SchemaValidationError';
    this.rawOutput = rawOutput;
    this.validationError = validationError;
  }
}

export class PIIError extends GuardianError {
  readonly matches: PIIMatch[];

  constructor(phase: 'input' | 'output', matches: PIIMatch[]) {
    super(
      phase === 'input' ? 'PII_DETECTED_IN_INPUT' : 'PII_DETECTED_IN_OUTPUT',
      `PII detected in ${phase}: ${matches.map((m) => m.type).join(', ')}`,
      { phase, count: matches.length }
    );
    this.name = 'PIIError';
    this.matches = matches;
  }
}

export class InjectionError extends GuardianError {
  readonly matches: InjectionMatch[];
  readonly score: number;

  constructor(matches: InjectionMatch[], score: number) {
    super(
      'PROMPT_INJECTION_DETECTED',
      `Prompt injection detected (score: ${score.toFixed(2)}).`,
      { score, patterns: matches.map((m) => m.pattern) }
    );
    this.name = 'InjectionError';
    this.matches = matches;
    this.score = score;
  }
}

export class BudgetError extends GuardianError {
  constructor(
    type: 'tokens' | 'cost',
    actual: number,
    limit: number,
    model: string
  ) {
    const label = type === 'tokens' ? 'tokens' : 'USD';
    super(
      'BUDGET_EXCEEDED',
      `Budget exceeded: ${actual} ${label} > limit of ${limit} ${label} (model: ${model})`,
      { type, actual, limit, model }
    );
    this.name = 'BudgetError';
  }
}
