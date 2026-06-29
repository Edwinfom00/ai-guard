import { cosineSimilarity } from '../../utils/embeddings.js';

export interface SemanticCacheConfig {
  enabled: boolean;
  /** Cosine similarity threshold to hit the cache. Default: 0.90 */
  threshold?: number;
  /** Maximum number of items in cache. Default: 1000 */
  maxSize?: number;
  /** Custom embedding function (optional if local @xenova/transformers is installed) */
  embedFn?: (text: string) => Promise<number[]>;
}

export interface CacheEntry {
  prompt: string;
  response: string;
  vector: number[];
  timestamp: number;
}

export class SemanticCache {
  private readonly entries: CacheEntry[] = [];
  private readonly maxSize: number;
  private readonly threshold: number;

  constructor(options: { maxSize?: number | undefined; threshold?: number | undefined } = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.threshold = options.threshold ?? 0.90;
  }

  public find(vector: number[]): CacheEntry | null {
    let bestMatch: CacheEntry | null = null;
    let highestSimilarity = -1;

    for (const entry of this.entries) {
      const similarity = cosineSimilarity(vector, entry.vector);
      if (similarity >= this.threshold && similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = entry;
      }
    }

    return bestMatch;
  }

  public add(prompt: string, response: string, vector: number[]): void {
    if (this.entries.length >= this.maxSize) {
      this.entries.shift(); // Evict oldest
    }
    this.entries.push({
      prompt,
      response,
      vector,
      timestamp: Date.now(),
    });
  }

  public clear(): void {
    this.entries.length = 0;
  }
}
