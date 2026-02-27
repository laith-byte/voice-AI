import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getClientId } from "../get-client-id";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(clientId?: string): NextRequest {
  const url = clientId
    ? `https://example.com/api/test?client_id=${clientId}`
    : "https://example.com/api/test";
  return new NextRequest(url);
}

/**
 * Build a chainable Supabase mock.
 *
 * Each call to `supabase.from(table)` returns the next result in order.
 * This matches how getClientId calls `from("users")` twice and then `from("clients")`.
 */
function makeMock(results: { data: unknown; error: unknown }[]) {
  let callIdx = 0;
  return {
    from: vi.fn(() => {
      const result = results[callIdx] || { data: null, error: null };
      callIdx++;
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve(result)),
            })),
            single: vi.fn(() => Promise.resolve(result)),
          })),
          is: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(result)),
          })),
        })),
      };
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getClientId", () => {
  // 1. Client role users get client_id from user record
  describe("client_* role users", () => {
    it("returns clientId from user record for client_admin", async () => {
      const supabase = makeMock([
        { data: { role: "client_admin", client_id: "client-abc" }, error: null },
      ]);

      const result = await getClientId({ id: "user-1" }, supabase, makeRequest());
      expect(result.clientId).toBe("client-abc");
      expect(result.error).toBeUndefined();
    });

    it("returns clientId from user record for client_member", async () => {
      const supabase = makeMock([
        { data: { role: "client_member", client_id: "client-xyz" }, error: null },
      ]);

      const result = await getClientId({ id: "user-1" }, supabase, makeRequest());
      expect(result.clientId).toBe("client-xyz");
      expect(result.error).toBeUndefined();
    });

    it("ignores client_id query param for client role users", async () => {
      const supabase = makeMock([
        { data: { role: "client_admin", client_id: "client-from-db" }, error: null },
      ]);

      const result = await getClientId(
        { id: "user-1" },
        supabase,
        makeRequest("should-be-ignored")
      );
      expect(result.clientId).toBe("client-from-db");
    });
  });

  // 2. Startup admin with valid ownership
  describe("startup admin — valid ownership", () => {
    it("returns clientId when client belongs to admin's organization", async () => {
      const supabase = makeMock([
        { data: { role: "startup_admin", client_id: null }, error: null },
        { data: { organization_id: "org-1" }, error: null },
        { data: { id: "client-xyz" }, error: null },
      ]);

      const result = await getClientId({ id: "user-1" }, supabase, makeRequest("client-xyz"));
      expect(result.clientId).toBe("client-xyz");
      expect(result.error).toBeUndefined();
    });
  });

  // 3. Startup admin — client not in org
  describe("startup admin — client not in org", () => {
    it("returns 404 when client doesn't belong to admin's org", async () => {
      const supabase = makeMock([
        { data: { role: "startup_admin", client_id: null }, error: null },
        { data: { organization_id: "org-1" }, error: null },
        { data: null, error: { code: "PGRST116" } },
      ]);

      const result = await getClientId({ id: "user-1" }, supabase, makeRequest("other-org-client"));
      expect(result.clientId).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error!.status).toBe(404);
    });
  });

  // 4. CRITICAL-10: Org check bypass on null organization_id — NOW FIXED
  describe("CRITICAL-10: org check bypass on null organization_id", () => {
    it("returns 403 when organization_id is null", async () => {
      const supabase = makeMock([
        { data: { role: "startup_admin", client_id: null }, error: null },
        { data: { organization_id: null }, error: null },
      ]);

      const result = await getClientId({ id: "user-1" }, supabase, makeRequest("any-client-id"));

      // FIX: null org now returns 403 instead of bypassing the check
      expect(result.clientId).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error!.status).toBe(403);
    });
  });

  // 5. Missing client_id in query params
  describe("missing client_id query param", () => {
    it("returns 400 for startup admin with no client_id", async () => {
      const supabase = makeMock([
        { data: { role: "startup_admin", client_id: null }, error: null },
      ]);

      const result = await getClientId({ id: "user-1" }, supabase, makeRequest());
      expect(result.clientId).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error!.status).toBe(400);
    });
  });

  // 6. User not found
  describe("user not found", () => {
    it("returns 404 when user record doesn't exist", async () => {
      const supabase = makeMock([
        { data: null, error: { code: "PGRST116" } },
      ]);

      const result = await getClientId({ id: "nonexistent" }, supabase, makeRequest("client-1"));
      expect(result.clientId).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error!.status).toBe(404);
    });
  });
});
