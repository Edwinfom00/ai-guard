export interface ContentPattern {
  id: string;
  category: 'toxicity' | 'hate' | 'violence' | 'selfharm' | 'sexual' | 'profanity';
  regex: RegExp;
  score: number;
}

export const CONTENT_PATTERNS: ContentPattern[] = [
  // ── Violence ───────────────────────────────────────────────────────────────
  {
    id: 'violence-explicit',
    category: 'violence',
    regex: /\b(?:kill|murder|assassinate|shoot|stab|bomb|blow up|massacre)\s+(?:him|her|them|you|everyone|people)\b/i,
    score: 0.9,
  },
  {
    id: 'violence-threat',
    category: 'violence',
    regex: /\b(?:i(?:'ll| will| am going to))\s+(?:kill|hurt|destroy|attack|harm)\b/i,
    score: 0.85,
  },

  // ── Self-harm ──────────────────────────────────────────────────────────────
  {
    id: 'selfharm-methods',
    category: 'selfharm',
    regex: /\b(?:how to|ways to|method(?:s)? (?:for|to))\s+(?:kill myself|commit suicide|end my life|self.harm)\b/i,
    score: 0.95,
  },
  {
    id: 'selfharm-ideation',
    category: 'selfharm',
    regex: /\b(?:want to die|don't want to live|better off dead|no reason to live)\b/i,
    score: 0.7,
  },

  // ── Hate speech ───────────────────────────────────────────────────────────
  {
    id: 'hate-slur',
    category: 'hate',
    regex: /\b(?:all\s+(?:\w+\s+)?(?:are|should be|deserve to|must be)\s+(?:killed|eliminated|removed|banned|exterminated))\b/i,
    score: 0.9,
  },
  {
    id: 'hate-dehumanization',
    category: 'hate',
    regex: /\b(?:sub.?human|vermin|parasite|infestation)\s+(?:are|is|those|they)\b/i,
    score: 0.85,
  },

  // ── Sexual (minors) ────────────────────────────────────────────────────────
  {
    id: 'sexual-minors',
    category: 'sexual',
    regex: /\b(?:child(?:ren)?|minor|underage|years? old)\b.*\b(?:sexual|nude|naked|explicit)\b/i,
    score: 1.0,
  },

  // ── Toxicity ───────────────────────────────────────────────────────────────
  {
    id: 'toxicity-severe',
    category: 'toxicity',
    regex: /\b(?:i hope you|you should|go)\s+(?:die|rot|suffer|choke|burn in hell)\b/i,
    score: 0.85,
  },
];

export const CONTENT_THRESHOLDS = {
  low:    0.95,
  medium: 0.75,
  high:   0.50,
} as const;
