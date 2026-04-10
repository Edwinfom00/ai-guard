import type { PIIType } from '../../types/index.js';

export interface PIIPattern {
  type: PIIType;
  regex: RegExp;
}

/**
 * Built-in PII detection patterns.
 * Each regex uses named capture groups and the global flag.
 */
export const PII_PATTERNS: PIIPattern[] = [
  {
    type: 'email',
    // RFC 5322 simplified — covers 99% of real-world emails
    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  },
  {
    type: 'phone',
    // International and local formats: +1 (555) 123-4567, 06 12 34 56 78, etc.
    regex: /(?:\+?\d{1,3}[\s\-.]?)?\(?\d{1,4}\)?[\s\-.]?\d{1,4}[\s\-.]?\d{1,9}/g,
  },
  {
    type: 'creditCard',
    // Visa, Mastercard, Amex, Discover — with optional separators
    regex: /\b(?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{0,4}\b/g,
  },
  {
    type: 'ssn',
    // US Social Security Number: 123-45-6789 or 123456789
    regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  },
  {
    type: 'ipAddress',
    // IPv4 addresses
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  },
  {
    type: 'iban',
    // International Bank Account Number: FR76 3000 6000 0112 3456 7890 189
    regex: /\b[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){1,7}[A-Z0-9]{1,4}\b/g,
  },
  {
    type: 'url',
    // HTTP/HTTPS URLs (useful for detecting API keys embedded in URLs)
    regex: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/g,
  },
];

export function getPatternsForTargets(targets: PIIType[]): PIIPattern[] {
  return PII_PATTERNS.filter((p) => targets.includes(p.type));
}
