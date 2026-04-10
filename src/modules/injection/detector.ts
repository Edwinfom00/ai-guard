import type { InjectionConfig, InjectionMatch } from '../../types/index.js';
import { InjectionError } from '../../core/errors.js';
import { INJECTION_PATTERNS, SENSITIVITY_THRESHOLDS } from './patterns.js';

export interface InjectionResult {
  detected: boolean;
  score: number;
  matches: InjectionMatch[];
}

/**
 * Analyzes text for prompt injection patterns.
 * Returns a score (0–1) and the matched patterns.
 */
export function detectInjection(text: string, config: InjectionConfig): InjectionResult {
  if (!config.enabled) {
    return { detected: false, score: 0, matches: [] };
  }

  const sensitivity = config.sensitivity ?? 'medium';
  const threshold = SENSITIVITY_THRESHOLDS[sensitivity];

  const allPatterns = [
    ...INJECTION_PATTERNS,
    ...(config.customPatterns ?? []).map((regex, i) => ({
      id: `custom-${i}`,
      description: 'Custom pattern',
      regex,
      score: 0.8, // Default score for custom patterns
    })),
  ];

  const matches: InjectionMatch[] = [];
  let maxScore = 0;

  for (const pattern of allPatterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags.includes('i') ? 'i' : '');
    if (regex.test(text)) {
      const matchResult = text.match(regex);
      matches.push({
        pattern: pattern.id,
        matchedText: matchResult?.[0] ?? '',
        score: pattern.score,
      });
      if (pattern.score > maxScore) maxScore = pattern.score;
    }
  }

  const detected = maxScore >= threshold;

  if (detected && config.throwOnDetection !== false) {
    throw new InjectionError(matches, maxScore);
  }

  return { detected, score: maxScore, matches };
}
