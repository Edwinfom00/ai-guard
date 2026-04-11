import type { GuardianMeta } from '../../types/index.js';

export interface AuditEntry {
  timestamp: string;
  /** SHA-256-like hash of the prompt (first 8 chars for privacy) */
  promptHash: string;
  promptLength: number;
  outputLength: number;
  piiRedactedCount: number;
  piiTypes: string[];
  injectionDetected: boolean;
  injectionScore: number;
  contentViolation: boolean;
  hallucinationSuspected: boolean;
  hallucinationScore: number;
  schemaRepairAttempts: number;
  tokensUsed: number | null;
  estimatedCostUSD: number | null;
  durationMs: number;
  model: string | null;
}

export type AuditHandler = (entry: AuditEntry) => void | Promise<void>;

/**
 * Simple non-cryptographic hash for prompt fingerprinting.
 * NOT for security — only for correlating log entries.
 */
function hashPrompt(text: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(text.length, 256); i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function buildAuditEntry(
  prompt: string,
  outputText: string,
  meta: GuardianMeta,
  extras: {
    contentViolation?: boolean;
    hallucinationSuspected?: boolean;
    hallucinationScore?: number;
  } = {}
): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    promptHash: hashPrompt(prompt),
    promptLength: prompt.length,
    outputLength: outputText.length,
    piiRedactedCount: meta.piiRedacted.length,
    piiTypes: [...new Set(meta.piiRedacted.map((m) => m.type))],
    injectionDetected: meta.injectionDetected.length > 0,
    injectionScore: meta.injectionDetected.reduce((max, m) => Math.max(max, m.score), 0),
    contentViolation: extras.contentViolation ?? false,
    hallucinationSuspected: extras.hallucinationSuspected ?? false,
    hallucinationScore: extras.hallucinationScore ?? 1,
    schemaRepairAttempts: meta.repairAttempts,
    tokensUsed: meta.budget?.totalTokens ?? null,
    estimatedCostUSD: meta.budget?.estimatedCostUSD ?? null,
    durationMs: meta.durationMs,
    model: meta.budget?.model ?? null,
  };
}
