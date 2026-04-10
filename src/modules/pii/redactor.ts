import type { PIIConfig, PIIMatch, PIIType } from '../../types/index.js';
import { detectPII } from './detector.js';

const ALL_TYPES: PIIType[] = ['email', 'phone', 'creditCard', 'ssn', 'ipAddress', 'iban', 'url'];

const defaultReplaceWith = (type: PIIType): string => `[REDACTED:${type.toUpperCase()}]`;

export interface RedactionResult {
  text: string;
  matches: PIIMatch[];
}

/**
 * Detects and redacts PII in a string.
 * Returns the sanitized text and the list of what was redacted.
 */
export function redactPII(text: string, config: PIIConfig = {}): RedactionResult {
  const targets = config.targets ?? ALL_TYPES;
  const replaceWith = config.replaceWith ?? defaultReplaceWith;

  const rawMatches = detectPII(text, targets);

  // Remove overlapping matches: keep the first match by position, skip any that overlap it.
  // Priority order follows the PII_PATTERNS array order (email > phone > creditCard > ...).
  const matches: typeof rawMatches = [];
  for (const match of rawMatches) {
    const overlaps = matches.some((m) => match.start < m.end && match.end > m.start);
    if (!overlaps) matches.push(match);
  }

  if (matches.length === 0) {
    return { text, matches: [] };
  }

  // Rebuild string from right-to-left to preserve indices
  let result = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    if (!match) continue;
    const token = replaceWith(match.type);
    // Update the match's redactedWith field to reflect the actual token used
    match.redactedWith = token;
    result = result.slice(0, match.start) + token + result.slice(match.end);
  }

  return { text: result, matches };
}
