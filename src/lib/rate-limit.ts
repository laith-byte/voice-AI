import { NextRequest, NextResponse } from "next/server";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function createRateLimiter({ windowMs, maxRequests }: { windowMs: number; maxRequests: number }) {
  const hits = new Map<string, number[]>();
  let lastCleanup = Date.now();

  function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < 60_000) return;
    lastCleanup = now;
    const cutoff = now - windowMs;
    for (const [key, timestamps] of hits) {
      const filtered = timestamps.filter((t) => t > cutoff);
      if (filtered.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, filtered);
      }
    }

    // Cap max entries to prevent memory leak from too many unique keys
    if (hits.size > 10_000) {
      const keys = Array.from(hits.keys());
      const deleteCount = Math.floor(keys.length / 2);
      for (let i = 0; i < deleteCount; i++) {
        hits.delete(keys[i]);
      }
    }
  }

  function check(key: string): RateLimitResult {
    cleanup();
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (hits.get(key) || []).filter((t) => t > cutoff);
    timestamps.push(now);
    hits.set(key, timestamps);

    const allowed = timestamps.length <= maxRequests;
    const remaining = Math.max(0, maxRequests - timestamps.length);
    const resetMs = timestamps.length > 0 ? timestamps[0] + windowMs - now : windowMs;

    return { allowed, remaining, resetMs };
  }

  return { check };
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export function rateLimitExceeded(resetMs: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) },
    }
  );
}

// HIGH-01: Use persistent (Redis) rate limiter when Upstash env vars are set,
// otherwise fall back to in-memory limiter.
import { createPersistentRateLimiter, isPersistentRateLimitAvailable } from "@/lib/rate-limit-persistent";
import { logger } from "@/lib/logger";

const inMemoryLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });
const persistentLimiter = isPersistentRateLimitAvailable()
  ? createPersistentRateLimiter({ windowMs: 60_000, maxRequests: 20, prefix: "pub" })
  : null;

let inMemoryWarningLogged = false;

export const publicEndpointLimiter = {
  check: persistentLimiter
    ? async (key: string) => persistentLimiter.check(key)
    : async (key: string) => {
        if (!inMemoryWarningLogged) {
          inMemoryWarningLogged = true;
          logger.warn("Rate limiting using in-memory fallback — limits are per-instance only");
        }
        return inMemoryLimiter.check(key);
      },
};
