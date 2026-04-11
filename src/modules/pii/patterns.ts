import type { PIIType } from '../../types/index.js';

export interface PIIPattern {
  type: PIIType;
  regex: RegExp;
}

/**
 * Built-in PII detection patterns — US + International (EU focus).
 */
export const PII_PATTERNS: PIIPattern[] = [
  // ── Universal ──────────────────────────────────────────────────────────────
  {
    type: 'email',
    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  },
  {
    type: 'url',
    regex: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/g,
  },
  {
    type: 'ipAddress',
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  },

  // ── Phone (international) ─────────────────────────────────────────────────
  {
    type: 'phone',
    regex: /(?:\+?\d{1,3}[\s\-.]?)?\(?\d{1,4}\)?[\s\-.]?\d{1,4}[\s\-.]?\d{1,9}/g,
  },

  // ── Credit Cards (Luhn-validated in detector) ─────────────────────────────
  {
    type: 'creditCard',
    regex: /\b(?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{0,4}\b/g,
  },

  // ── US ────────────────────────────────────────────────────────────────────
  {
    type: 'ssn',
    regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  },
  {
    type: 'passport',
    // US passport: 9 digits
    regex: /\b[A-Z]{0,2}\d{6,9}\b/g,
  },

  // ── IBAN (international) ──────────────────────────────────────────────────
  {
    type: 'iban',
    regex: /\b[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){1,7}[A-Z0-9]{1,4}\b/g,
  },

  // ── France ───────────────────────────────────────────────────────────────
  {
    type: 'nir',
    // Numéro de sécurité sociale français: 1 ou 2, suivi de 13 chiffres + 2 clé
    regex: /\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b/g,
  },
  {
    type: 'siret',
    // SIRET: 14 chiffres (SIREN 9 + NIC 5)
    regex: /\b\d{3}[\s\-.]?\d{3}[\s\-.]?\d{3}[\s\-.]?\d{5}\b/g,
  },
  {
    type: 'siren',
    // SIREN: 9 chiffres
    regex: /\b\d{3}[\s\-.]?\d{3}[\s\-.]?\d{3}\b/g,
  },

  // ── Date de naissance ─────────────────────────────────────────────────────
  {
    type: 'dateOfBirth',
    // Formats: DD/MM/YYYY, MM-DD-YYYY, YYYY-MM-DD, DD.MM.YYYY
    regex: /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g,
  },
];

export const ALL_PII_TYPES: PIIType[] = PII_PATTERNS.map((p) => p.type);

export function getPatternsForTargets(targets: PIIType[]): PIIPattern[] {
  return PII_PATTERNS.filter((p) => targets.includes(p.type));
}
