import { GuardianError } from '../../core/errors.js';
import { CONTENT_PATTERNS, CONTENT_THRESHOLDS } from './patterns.js';
import type { ContentPattern } from './patterns.js';

export type ContentSensitivity = 'low' | 'medium' | 'high';
export type ContentCategory = ContentPattern['category'];

export interface ContentConfig {
  enabled: boolean;
  sensitivity?: ContentSensitivity;
  /** Categories to check. Default: all */
  categories?: ContentCategory[];
  /** Additional custom patterns */
  customPatterns?: Array<{ regex: RegExp; category: ContentCategory; score: number }>;
  /** Throw on detection. Default: true */
  throwOnDetection?: boolean;
}

export interface ContentMatch {
  id: string;
  category: ContentCategory;
  matchedText: string;
  score: number;
}

export interface ContentResult {
  detected: boolean;
  score: number;
  categories: ContentCategory[];
  matches: ContentMatch[];
}

export function detectContent(text: string, config: ContentConfig): ContentResult {
  if (!config.enabled) {
    return { detected: false, score: 0, categories: [], matches: [] };
  }

  const sensitivity = config.sensitivity ?? 'medium';
  const threshold = CONTENT_THRESHOLDS[sensitivity];
  const allowedCategories = config.categories;

  const patterns = [
    ...CONTENT_PATTERNS,
    ...(config.customPatterns ?? []).map((p, i) => ({
      id: `custom-${i}`,
      ...p,
    })),
  ].filter((p) => !allowedCategories || allowedCategories.includes(p.category));

  const matches: ContentMatch[] = [];
  let maxScore = 0;

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex.source, 'i');
    const match = text.match(regex);
    if (match) {
      matches.push({
        id: pattern.id,
        category: pattern.category,
        matchedText: match[0] ?? '',
        score: pattern.score,
      });
      if (pattern.score > maxScore) maxScore = pattern.score;
    }
  }

  const detected = maxScore >= threshold;

  if (detected && config.throwOnDetection !== false) {
    throw new GuardianError(
      'CONTENT_POLICY_VIOLATION',
      `Content policy violation detected (score: ${maxScore.toFixed(2)}, categories: ${[...new Set(matches.map((m) => m.category))].join(', ')})`,
      { score: maxScore, categories: matches.map((m) => m.category) }
    );
  }

  return {
    detected,
    score: maxScore,
    categories: [...new Set(matches.map((m) => m.category))],
    matches,
  };
}
