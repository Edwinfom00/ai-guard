import type { PIIMatch, BudgetUsage } from './index.js';
import type { InjectionResult } from '../modules/injection/detector.js';

export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export interface InspectPromptReport {
  pii: PIIMatch[];
  injection: InjectionResult;
}

export interface InspectOutputReport {
  pii: PIIMatch[];
  schemaValid: boolean;
  schemaError?: unknown;
  repairAttempts: number;
}

export interface InspectReport {
  prompt: InspectPromptReport;
  output: InspectOutputReport | null;
  budget: BudgetUsage | null;
  /** Overall risk level computed from all findings */
  overallRisk: RiskLevel;
  /** Numeric risk score 0–1 for custom thresholds */
  riskScore: number;
  /** Human-readable summary of findings */
  summary: string[];
}
