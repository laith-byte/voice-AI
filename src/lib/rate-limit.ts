import { NextRequest, NextResponse } from "next/server";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

function createRateLimiter({ windowMs, maxRequests }: { windowMs: number; maxRequests: number }) {
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

export const publicEndpointLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });
