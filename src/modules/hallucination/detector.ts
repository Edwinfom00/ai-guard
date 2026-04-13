import { GuardianError } from '../../core/errors.js';

export interface HallucinationConfig {
  sources: string[];
  threshold?: number;
  throwOnDetection?: boolean;
}

export interface HallucinationResult {
  suspected: boolean;
  groundingScore: number;
  entitiesFound: string[];
  ungroundedEntities: string[];
  groundedEntities: string[];
}

export function extractEntities(text: string): string[] {
  const entities = new Set<string>();

  const numbers = text.match(/\b\d+(?:[.,]\d+)?(?:\s?%|\s?€|\s?\$|\s?USD|\s?EUR)?\b/g) ?? [];
  numbers.forEach((n) => entities.add(n.trim()));

  const properNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) ?? [];
  properNouns.forEach((n) => entities.add(n.trim()));

  const years = text.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  years.forEach((y) => entities.add(y));

  const quoted = text.match(/"([^"]{3,50})"/g) ?? [];
  quoted.forEach((q) => entities.add(q.replace(/"/g, '').trim()));

  return [...entities].filter((e) => {
    if (e.length <= 2) return false;
    // Ignore standalone small numbers (1–999) — too common to be meaningful
    if (/^\d{1,3}$/.test(e)) return false;
    // Ignore pure punctuation/symbols
    if (/^[^a-zA-Z0-9]+$/.test(e)) return false;
    return true;
  });
}

export function detectHallucination(
  response: string,
  config: HallucinationConfig
): HallucinationResult {
  const { sources, threshold = 0.6, throwOnDetection = false } = config;

  if (sources.length === 0) {
    return { suspected: false, groundingScore: 1, entitiesFound: [], ungroundedEntities: [], groundedEntities: [] };
  }

  const combinedSources = sources.join(' ').toLowerCase();
  const entities = extractEntities(response);

  if (entities.length === 0) {
    return { suspected: false, groundingScore: 1, entitiesFound: [], ungroundedEntities: [], groundedEntities: [] };
  }

  const groundedEntities: string[] = [];
  const ungroundedEntities: string[] = [];

  for (const entity of entities) {
    if (combinedSources.includes(entity.toLowerCase())) {
      groundedEntities.push(entity);
    } else {
      ungroundedEntities.push(entity);
    }
  }

  const groundingScore = groundedEntities.length / entities.length;
  const suspected = groundingScore < threshold;

  if (suspected && throwOnDetection) {
    throw new GuardianError(
      'HALLUCINATION_SUSPECTED',
      `Hallucination suspected: only ${Math.round(groundingScore * 100)}% of entities grounded in sources.`,
      { groundingScore, ungroundedEntities }
    );
  }

  return { suspected, groundingScore, entitiesFound: entities, ungroundedEntities, groundedEntities };
}
