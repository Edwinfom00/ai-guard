import { checkBudget } from '../modules/budget/sentinel.js';
import type { BudgetUsage, BudgetConfig } from '../types/index.js';
import type { AuditEntry } from '../modules/audit/index.js';

export interface GuardianSessionConfig {
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export class GuardianSession {
  public readonly sessionId: string;
  public readonly metadata: Record<string, unknown>;

  private cumulativeTokens = 0;
  private cumulativeCost = 0;
  private canaryTokens: string[] = [];
  private auditEntries: AuditEntry[] = [];

  constructor(config: GuardianSessionConfig = {}) {
    this.sessionId = config.sessionId ?? `sess_${Math.random().toString(36).substring(2, 11)}`;
    this.metadata = config.metadata ?? {};
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getCumulativeTokens(): number {
    return this.cumulativeTokens;
  }

  public getCumulativeCost(): number {
    return this.cumulativeCost;
  }

  public addCanaryToken(token: string): void {
    this.canaryTokens.push(token);
  }

  public getCanaryTokens(): string[] {
    return this.canaryTokens;
  }

  public recordUsage(usage: BudgetUsage): void {
    this.cumulativeTokens += usage.totalTokens;
    this.cumulativeCost += usage.estimatedCostUSD;
  }

  public recordAudit(entry: AuditEntry): void {
    this.auditEntries.push(entry);
  }

  public getAuditEntries(): AuditEntry[] {
    return this.auditEntries;
  }

  /**
   * Validates the cumulative usage of the session against a budget configuration.
   * Throws BudgetError if the limit is exceeded.
   */
  public checkBudget(config?: BudgetConfig): void {
    if (!config) return;
    checkBudget(
      {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: this.cumulativeTokens,
        estimatedCostUSD: this.cumulativeCost,
        model: config.model ?? 'unknown',
      },
      config
    );
  }
}
