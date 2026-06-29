import type { PIIConfig, PIIMatch, PIIType } from '../../types/index.js';
import { detectPII } from './detector.js';
import { ALL_PII_TYPES } from './patterns.js';

const defaultReplaceWith = (type: PIIType): string => `[REDACTED:${type.toUpperCase()}]`;

export interface RedactionResult {
  text: string;
  matches: PIIMatch[];
  tokensMap?: Map<string, string>;
}

/**
 * Detects and redacts PII in a string.
 * Returns the sanitized text, the list of what was redacted, and optionally a tokensMap for re-hydration.
 */
export function redactPII(text: string, config: PIIConfig = {}): RedactionResult {
  const targets = config.targets ?? ALL_PII_TYPES;
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

  const tokensMap = new Map<string, string>();
  const valueToToken = new Map<string, string>();
  const typeCounters = new Map<string, number>();

  // Determine token for each match (from left-to-right to build indices sequentially)
  const tokens: string[] = [];
  for (const match of rawMatches) {
    const overlaps = matches.some((m) => match.start < m.end && match.end > m.start);
    // Since matches only contains non-overlapping matches, let's filter match.
    // Actually, we should only iterate over the filtered non-overlapping matches!
  }
  
  // Let's rewrite the loop over the filtered matches:
  const finalTokens: string[] = [];
  for (const match of matches) {
    const value = text.slice(match.start, match.end);
    let token: string;
    if (config.reversible) {
      if (valueToToken.has(value)) {
        token = valueToToken.get(value)!;
      } else {
        const count = (typeCounters.get(match.type) ?? 0) + 1;
        typeCounters.set(match.type, count);
        token = `[REDACTED:${match.type.toUpperCase()}_${count}]`;
        valueToToken.set(value, token);
        tokensMap.set(token, value);
      }
    } else {
      token = replaceWith(match.type);
    }
    finalTokens.push(token);
  }

  // Rebuild string from right-to-left to preserve indices
  let result = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const token = finalTokens[i];
    if (!match || token === undefined) continue;
    // Update the match's redactedWith field to reflect the actual token used
    match.redactedWith = token;
    result = result.slice(0, match.start) + token + result.slice(match.end);
  }

  return {
    text: result,
    matches,
    ...(config.reversible && { tokensMap }),
  };
}
