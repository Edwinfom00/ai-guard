export interface InjectionPattern {
  id: string;
  description: string;
  regex: RegExp;
  /** Score weight: higher = more dangerous */
  score: number;
}

/**
 * Curated library of prompt injection patterns.
 * Organized by attack category.
 */
export const INJECTION_PATTERNS: InjectionPattern[] = [
  // ── Instruction Override ────────────────────────────────────────────────────
  {
    id: 'ignore-instructions',
    description: 'Classic "ignore previous instructions" attack',
    regex: /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+instructions?/i,
    score: 0.9,
  },
  {
    id: 'disregard-instructions',
    description: 'Disregard / forget instructions variant',
    regex: /(?:disregard|forget|override|bypass|circumvent)\s+(?:all\s+)?(?:previous|prior|your|the)\s+instructions?/i,
    score: 0.9,
  },
  {
    id: 'new-instructions',
    description: 'Injecting new instruction set',
    regex: /(?:your\s+new\s+instructions?|new\s+system\s+prompt|act\s+as\s+if\s+your\s+instructions?)/i,
    score: 0.8,
  },

  // ── Role / Identity Hijacking ────────────────────────────────────────────────
  {
    id: 'jailbreak-dan',
    description: 'DAN (Do Anything Now) jailbreak pattern',
    regex: /\bDAN\b|do\s+anything\s+now/i,
    score: 0.95,
  },
  {
    id: 'pretend-no-restrictions',
    description: 'Asking model to pretend it has no restrictions',
    regex: /pretend\s+(?:you\s+have\s+no|there\s+are\s+no)\s+(?:restrictions?|limits?|rules?|guidelines?)/i,
    score: 0.85,
  },
  {
    id: 'act-as-unrestricted',
    description: 'Act as unrestricted AI variant',
    regex: /act\s+as\s+(?:an?\s+)?(?:unrestricted|uncensored|unfiltered|jailbroken)\s+(?:AI|model|assistant|version)/i,
    score: 0.85,
  },

  // ── System Prompt Extraction ─────────────────────────────────────────────────
  {
    id: 'reveal-system-prompt',
    description: 'Attempting to extract the system prompt',
    regex: /(?:reveal|show|print|output|repeat|display|tell\s+me)\s+(?:your\s+)?(?:system\s+prompt|initial\s+instructions?|context\s+window|original\s+prompt)/i,
    score: 0.9,
  },
  {
    id: 'what-are-your-instructions',
    description: 'Asking for instructions verbatim',
    regex: /what\s+(?:are|were)\s+your\s+(?:exact\s+)?instructions?/i,
    score: 0.7,
  },

  // ── Code Injection via Prompt ────────────────────────────────────────────────
  {
    id: 'eval-injection',
    description: 'Attempting to inject eval/exec code',
    regex: /(?:eval|exec|execute|run)\s*\(.*(?:process\.env|require\(|__dirname)/i,
    score: 0.95,
  },
  {
    id: 'shell-command-injection',
    description: 'Shell command injection attempt',
    regex: /(?:rm\s+-rf|sudo\s+|chmod\s+777|curl\s+http|wget\s+http|bash\s+-c|sh\s+-c)/i,
    score: 0.95,
  },

  // ── Data Exfiltration ────────────────────────────────────────────────────────
  {
    id: 'leak-api-key',
    description: 'Attempting to extract API keys or secrets',
    regex: /(?:send|leak|exfiltrate|output|reveal)\s+(?:the\s+)?(?:api\s+key|secret|token|password|credentials?)/i,
    score: 0.9,
  },

  // ── Indirect Injection (via documents) ──────────────────────────────────────
  {
    id: 'indirect-injection-marker',
    description: 'Hidden instruction injection in documents',
    regex: /\[SYSTEM\]|\[INST\]|<\|system\|>|<\|user\|>|<\|assistant\|>/i,
    score: 0.8,
  },
];

export const SENSITIVITY_THRESHOLDS = {
  low: 0.95,    // Only fire on near-certain attacks
  medium: 0.75, // Balanced
  high: 0.5,    // Aggressive — may have false positives
} as const;
