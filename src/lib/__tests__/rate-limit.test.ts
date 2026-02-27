import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { getClientIp, rateLimitExceeded, publicEndpointLimiter } from "../rate-limit";

describe("getClientIp", () => {
  function makeRequest(headers: Record<string, string> = {}): NextRequest {
    const req = new NextRequest("http://localhost/test", {
      headers: new Headers(headers),
    });
    return req;
  }

  it("extracts IP from x-forwarded-for header", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("extracts first IP from comma-separated x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("trims whitespace from x-forwarded-for IP", () => {
    const req = makeRequest({ "x-forwarded-for": "  1.2.3.4  , 5.6.7.8" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = makeRequest({ "x-real-ip": "10.0.0.1" });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toBe("unknown");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });
});

describe("rateLimitExceeded", () => {
  it("returns status 429", () => {
    const res = rateLimitExceeded(5000);
    expect(res.status).toBe(429);
  });

  it("returns JSON body with error message", async () => {
    const res = rateLimitExceeded(5000);
    const body = await res.json();
    expect(body).toEqual({ error: "Too many requests" });
  });

  it("sets Retry-After header (ceiling of seconds)", () => {
    const res = rateLimitExceeded(5500);
    expect(res.headers.get("Retry-After")).toBe("6");
  });

  it("handles sub-second resetMs", () => {
    const res = rateLimitExceeded(100);
    expect(res.headers.get("Retry-After")).toBe("1");
  });

  it("handles exact second boundary", () => {
    const res = rateLimitExceeded(3000);
    expect(res.headers.get("Retry-After")).toBe("3");
  });

  it("handles zero resetMs", () => {
    const res = rateLimitExceeded(0);
    expect(res.headers.get("Retry-After")).toBe("0");
  });
});

describe("publicEndpointLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request", async () => {
    const ip = `test-ip-${Date.now()}`;
    const result = await publicEndpointLimiter.check(ip);
    expect(result.allowed).toBe(true);
  });

  it("reports correct remaining count after first request", async () => {
    const ip = `test-ip-remaining-${Date.now()}`;
    const result = await publicEndpointLimiter.check(ip);
    expect(result.remaining).toBe(19);
  });

  it("allows up to 20 requests within the window", async () => {
    const ip = `test-ip-20-${Date.now()}`;
    let result;
    for (let i = 0; i < 20; i++) {
      result = await publicEndpointLimiter.check(ip);
      expect(result.allowed).toBe(true);
    }
    expect(result!.remaining).toBe(0);
  });

  it("blocks the 21st request", async () => {
    const ip = `test-ip-21-${Date.now()}`;
    for (let i = 0; i < 20; i++) {
      await publicEndpointLimiter.check(ip);
    }
    const result = await publicEndpointLimiter.check(ip);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("returns positive resetMs when blocked", async () => {
    const ip = `test-ip-reset-${Date.now()}`;
    for (let i = 0; i < 21; i++) {
      await publicEndpointLimiter.check(ip);
    }
    const result = await publicEndpointLimiter.check(ip);
    expect(result.resetMs).toBeGreaterThan(0);
  });

  it("different IPs have independent limits", async () => {
    const ipA = `test-ip-A-${Date.now()}`;
    const ipB = `test-ip-B-${Date.now()}`;

    // Exhaust IP A
    for (let i = 0; i < 20; i++) {
      await publicEndpointLimiter.check(ipA);
    }
    const blockedA = await publicEndpointLimiter.check(ipA);
    expect(blockedA.allowed).toBe(false);

    // IP B should still be allowed
    const resultB = await publicEndpointLimiter.check(ipB);
    expect(resultB.allowed).toBe(true);
    expect(resultB.remaining).toBe(19);
  });

  it("allows requests again after window expires", async () => {
    const ip = `test-ip-window-${Date.now()}`;

    // Exhaust the limit
    for (let i = 0; i < 21; i++) {
      await publicEndpointLimiter.check(ip);
    }
    const blocked = await publicEndpointLimiter.check(ip);
    expect(blocked.allowed).toBe(false);

    // Advance time past the 60-second window
    vi.advanceTimersByTime(60_001);

    const result = await publicEndpointLimiter.check(ip);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(19);
  });

  it("boundary: 20th request is allowed with remaining=0", async () => {
    const ip = `test-ip-boundary-${Date.now()}`;
    for (let i = 0; i < 19; i++) {
      await publicEndpointLimiter.check(ip);
    }
    const result = await publicEndpointLimiter.check(ip);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });
});
