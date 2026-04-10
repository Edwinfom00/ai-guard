import type { PIIMatch, PIIType } from '../../types/index.js';
import { getPatternsForTargets, PII_PATTERNS } from './patterns.js';

const ALL_TYPES: PIIType[] = PII_PATTERNS.map((p) => p.type);

/**
 * Scans text and returns all PII matches found, with their positions.
 */
export function detectPII(text: string, targets: PIIType[] = ALL_TYPES): PIIMatch[] {
  const patterns = getPatternsForTargets(targets);
  const matches: PIIMatch[] = [];

  for (const { type, regex } of patterns) {
    // Reset lastIndex since we reuse regexes with global flag
    const clonedRegex = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;

    while ((match = clonedRegex.exec(text)) !== null) {
      const value = match[0] ?? '';

      // Skip very short matches that are likely false positives (e.g. phone regex on "12")
      if (shouldSkip(type, value)) continue;

      matches.push({
        type,
        value,
        start: match.index,
        end: match.index + value.length,
        redactedWith: `[REDACTED:${type.toUpperCase()}]`,
      });
    }
  }

  // Sort by position in text
  return matches.sort((a, b) => a.start - b.start);
}

/**
 * Filter out low-confidence matches.
 */
function shouldSkip(type: PIIType, value: string): boolean {
  switch (type) {
    case 'phone':
      // Must have at least 7 digits to be a real phone number
      if (value.replace(/\D/g, '').length < 7) return true;
      // Reject values that look like IPv4 addresses
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value.trim())) return true;
      return false;
    case 'creditCard':
      // Must pass Luhn algorithm
      return !luhn(value.replace(/[\s\-]/g, ''));
    case 'iban':
      // Must be at least 15 chars
      return value.replace(/\s/g, '').length < 15;
    default:
      return false;
  }
}

/**
 * Luhn algorithm to validate credit card numbers.
 */
function luhn(number: string): boolean {
  let sum = 0;
  let isEven = false;

  for (let i = number.length - 1; i >= 0; i--) {
    const char = number[i];
    if (char === undefined) continue;
    let digit = parseInt(char, 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}
