export interface RateLimitStore {
  incrementRequests(
    key: string,
    windowMs: number
  ): Promise<{ requests: number; windowStart: number }>;

  addTokens(
    key: string,
    tokens: number,
    windowMs: number
  ): Promise<{ tokens: number; windowStart: number }>;

  getUsage(
    key: string
  ): Promise<{ requests: number; tokens: number; windowStart: number } | null>;

  reset(): Promise<void>;
}

export class InMemoryStore implements RateLimitStore {
  private readonly buckets = new Map<
    string,
    { requests: number; tokens: number; windowStart: number }
  >();

  async incrementRequests(key: string, windowMs: number) {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart >= windowMs) {
      bucket = { requests: 0, tokens: 0, windowStart: now };
      this.buckets.set(key, bucket);
    }
    bucket.requests++;
    return bucket;
  }

  async addTokens(key: string, tokens: number, windowMs: number) {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart >= windowMs) {
      bucket = { requests: 0, tokens: 0, windowStart: now };
      this.buckets.set(key, bucket);
    }
    bucket.tokens += tokens;
    return bucket;
  }

  async getUsage(key: string) {
    return this.buckets.get(key) ?? null;
  }

  async reset() {
    this.buckets.clear();
  }
}
