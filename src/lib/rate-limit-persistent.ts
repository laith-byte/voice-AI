import { Redis } from "@upstash/redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

/**
 * Persistent rate limiter using Upstash Redis sliding window.
 * Falls back to the in-memory limiter if env vars are not configured.
 *
 * Requires: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */
export function createPersistentRateLimiter({
  windowMs,
  maxRequests,
  prefix = "rl",
}: {
  windowMs: number;
  maxRequests: number;
  prefix?: string;
}) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  async function check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowKey = `${prefix}:${key}`;
    const windowStart = now - windowMs;

    // Use a Redis pipeline for atomicity:
    // 1. Remove expired entries
    // 2. Add current timestamp
    // 3. Count entries in window
    // 4. Set TTL on the key
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(windowKey, 0, windowStart);
    pipe.zadd(windowKey, { score: now, member: `${now}:${Math.random().toString(36).slice(2, 8)}` });
    pipe.zcard(windowKey);
    pipe.pexpire(windowKey, windowMs);

    const results = await pipe.exec();
    const count = (results[2] as number) || 0;

    const allowed = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);

    return { allowed, remaining, resetMs: windowMs };
  }

  return { check };
}

/**
 * Check if persistent rate limiting is available (env vars configured).
 */
export function isPersistentRateLimitAvailable(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
