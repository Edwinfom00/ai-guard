import type { RateLimitStore } from './store.js';

export interface GenericRedisClient {
  exists(key: string): any;
  hincrby(key: string, field: string, increment: number): any;
  hget(key: string, field: string): any;
  hset(key: string, field: string, value: string): any;
  pexpire(key: string, milliseconds: number): any;
  hgetall(key: string): any;
  keys?(pattern: string): any;
  del(key: string): any;
}

export class RedisRateLimitStore implements RateLimitStore {
  private readonly client: GenericRedisClient;

  constructor(client: GenericRedisClient) {
    this.client = client;
  }

  async incrementRequests(key: string, windowMs: number) {
    const redisKey = `ai_guard:ratelimit:${key}`;
    const exists = await this.client.exists(redisKey);

    const count = await this.client.hincrby(redisKey, 'requests', 1);
    if (!exists) {
      await this.client.pexpire(redisKey, windowMs);
      await this.client.hset(redisKey, 'windowStart', String(Date.now()));
    }

    const windowStartStr = await this.client.hget(redisKey, 'windowStart');
    const windowStart = windowStartStr ? parseInt(windowStartStr, 10) : Date.now();

    return { requests: count, windowStart };
  }

  async addTokens(key: string, tokens: number, windowMs: number) {
    const redisKey = `ai_guard:ratelimit:${key}`;
    const exists = await this.client.exists(redisKey);

    const count = await this.client.hincrby(redisKey, 'tokens', tokens);
    if (!exists) {
      await this.client.pexpire(redisKey, windowMs);
      await this.client.hset(redisKey, 'windowStart', String(Date.now()));
    }

    const windowStartStr = await this.client.hget(redisKey, 'windowStart');
    const windowStart = windowStartStr ? parseInt(windowStartStr, 10) : Date.now();

    return { tokens: count, windowStart };
  }

  async getUsage(key: string) {
    const redisKey = `ai_guard:ratelimit:${key}`;
    const data = await this.client.hgetall(redisKey);
    if (!data || Object.keys(data).length === 0) return null;
    
    return {
      requests: data.requests ? parseInt(data.requests, 10) : 0,
      tokens: data.tokens ? parseInt(data.tokens, 10) : 0,
      windowStart: data.windowStart ? parseInt(data.windowStart, 10) : Date.now(),
    };
  }

  async reset() {
    if (typeof this.client.keys === 'function') {
      const keys = await this.client.keys('ai_guard:ratelimit:*');
      if (keys && keys.length > 0) {
        for (const key of keys) {
          await this.client.del(key);
        }
      }
    }
  }
}
