export type EmbedFunction = (text: string) => Promise<number[]>;

let localPipeline: any = null;

/**
   * Computes the cosine similarity between two vectors.
   */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
   * Returns embedding vector for a given text.
   * If embedFn is provided, uses it (cloud).
   * Else, attempts to lazy-load @xenova/transformers for local feature-extraction.
   */
export async function getEmbedding(
  text: string,
  embedFn?: EmbedFunction
): Promise<number[]> {
  if (embedFn) {
    return await embedFn(text);
  }

  try {
    if (!localPipeline) {
      // Dynamic import to support optional peer dependency
      // @ts-ignore
      const { pipeline } = await import('@xenova/transformers');
      localPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    const output = await localPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (error) {
    throw new Error(
      'To use local semantic features, please install "@xenova/transformers" (npm i @xenova/transformers) or provide a custom "embedFn".'
    );
  }
}
