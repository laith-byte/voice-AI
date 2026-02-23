import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeHousecallPro } from "../housecallpro";

// Mock dependencies
const mockGetValidToken = vi.fn();
const mockExtractStructuredData = vi.fn();
const mockMapServiceToCategory = vi.fn();
const mockLogIntegrationEvent = vi.fn();
const mockEnqueueRetry = vi.fn();

vi.mock("@/lib/oauth/token-manager", () => ({
  getValidToken: (...args: unknown[]) => mockGetValidToken(...args),
}));

vi.mock("@/lib/transcript-extraction", () => ({
  extractStructuredData: (...args: unknown[]) => mockExtractStructuredData(...args),
}));

vi.mock("@/lib/service-mapper", () => ({
  mapServiceToCategory: (...args: unknown[]) => mockMapServiceToCategory(...args),
}));

vi.mock("@/lib/integration-events", () => ({
  logIntegrationEvent: (...args: unknown[]) => mockLogIntegrationEvent(...args),
}));

vi.mock("@/lib/integration-retry", () => ({
  enqueueRetry: (...args: unknown[]) => mockEnqueueRetry(...args),
}));

function makeCallLog(overrides: Partial<Parameters<typeof executeHousecallPro>[0]> = {}) {
  return {
    id: "log-1",
    retell_call_id: "retell-1",
    from_number: "+15551234567",
    to_number: "+15559876543",
    direction: "inbound",
    status: "completed",
    duration_seconds: 185,
    summary: "Customer needs AC repair",
    started_at: "2026-01-01T00:00:00Z",
    ended_at: "2026-01-01T00:03:05Z",
    post_call_analysis: null,
    transcript: "Hello, I need my AC fixed.",
    ...overrides,
  };
}

const EXTRACTED_DATA = {
  caller_name: "John Smith",
  phone: "+15551234567",
  email: "john@example.com",
  address: "123 Main St",
  service_requested: "AC Repair",
  urgency: "urgent" as const,
  preferred_time: "Monday morning",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetValidToken.mockResolvedValue("test-token");
  mockExtractStructuredData.mockReturnValue(EXTRACTED_DATA);
  mockMapServiceToCategory.mockResolvedValue({
    external_category_name: "Air Conditioning Repair",
    external_category_id: "cat-1",
    default_duration_minutes: 90,
    default_price_cents: 8900,
  });
  mockEnqueueRetry.mockResolvedValue(undefined);

  // Mock global fetch
  vi.stubGlobal("fetch", vi.fn());
});

describe("executeHousecallPro", () => {
  it("returns early when from_number is null", async () => {
    await executeHousecallPro(makeCallLog({ from_number: null }), "client-1", {});
    expect(mockGetValidToken).not.toHaveBeenCalled();
  });

  it("enqueues retry and returns on token error", async () => {
    mockGetValidToken.mockRejectedValue(new Error("Token expired"));

    await executeHousecallPro(makeCallLog(), "client-1", {});

    expect(mockEnqueueRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-1",
        provider: "housecallpro",
        action: "post_call_sync",
      })
    );
    expect(mockLogIntegrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "token_error",
        status: "retrying",
      })
    );
  });

  it("searches for existing customer by phone", async () => {
    const mockFetch = vi.fn()
      // Customer search — found
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ customers: [{ id: "cust-1" }], total_items: 1 }),
      })
      // Note creation
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    vi.stubGlobal("fetch", mockFetch);

    await executeHousecallPro(makeCallLog(), "client-1", {});

    expect(mockFetch.mock.calls[0][0]).toContain("/pro/v1/customers?phone=");
  });

  it("creates customer when not found and logs event", async () => {
    const mockFetch = vi.fn()
      // Customer search — not found
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ customers: [], total_items: 0 }),
      })
      // Customer creation
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "new-cust-1" }),
      })
      // Note creation
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    vi.stubGlobal("fetch", mockFetch);

    await executeHousecallPro(makeCallLog(), "client-1", {});

    // Second call should be POST to /customers
    expect(mockFetch.mock.calls[1][0]).toContain("/pro/v1/customers");
    expect(mockFetch.mock.calls[1][1].method).toBe("POST");

    // Should log customer_created event
    expect(mockLogIntegrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "customer_created" })
    );
  });

  it("logs customer_created_and_note_logged for new customers", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ customers: [], total_items: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "new-cust-1" }),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    vi.stubGlobal("fetch", mockFetch);

    await executeHousecallPro(makeCallLog(), "client-1", {});

    expect(mockLogIntegrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "customer_created_and_note_logged",
      })
    );
  });

  it("logs note_logged for existing customers", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ customers: [{ id: "cust-1" }], total_items: 1 }),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    vi.stubGlobal("fetch", mockFetch);

    await executeHousecallPro(makeCallLog(), "client-1", {});

    expect(mockLogIntegrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "note_logged" })
    );
  });

  it("throws on customer search failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 500 })
    );

    await expect(
      executeHousecallPro(makeCallLog(), "client-1", {})
    ).rejects.toThrow("customer search failed: 500");
  });

  it("throws on customer creation failure", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ customers: [], total_items: 0 }),
      })
      .mockResolvedValueOnce({ ok: false, status: 422 });

    vi.stubGlobal("fetch", mockFetch);

    await expect(
      executeHousecallPro(makeCallLog(), "client-1", {})
    ).rejects.toThrow("customer creation failed: 422");
  });

  it("enqueues retry on transient error (429)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 429 })
    );

    await expect(
      executeHousecallPro(makeCallLog(), "client-1", {})
    ).rejects.toThrow();

    expect(mockEnqueueRetry).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "housecallpro" })
    );
  });

  it("enqueues retry on 500 error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 500 })
    );

    await expect(
      executeHousecallPro(makeCallLog(), "client-1", {})
    ).rejects.toThrow();

    expect(mockEnqueueRetry).toHaveBeenCalled();
  });

  it("does not enqueue retry on non-transient error (400)", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ customers: [], total_items: 0 }),
      })
      .mockResolvedValueOnce({ ok: false, status: 400 });

    vi.stubGlobal("fetch", mockFetch);

    await expect(
      executeHousecallPro(makeCallLog(), "client-1", {})
    ).rejects.toThrow();

    // enqueueRetry should NOT have been called for the catch block
    // (it may have been called 0 times total, or we check the last call)
    const retryCalls = mockEnqueueRetry.mock.calls;
    const catchRetry = retryCalls.find(
      (call) => call[0]?.action === "post_call_sync"
    );
    expect(catchRetry).toBeUndefined();
  });

  it("logs sync_failed on error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 503 })
    );

    await expect(
      executeHousecallPro(makeCallLog(), "client-1", {})
    ).rejects.toThrow();

    expect(mockLogIntegrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "sync_failed",
        status: "failed",
      })
    );
  });

  it("calls extractStructuredData with transcript, summary, analysis", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ customers: [{ id: "c1" }], total_items: 1 }),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    vi.stubGlobal("fetch", mockFetch);

    const callLog = makeCallLog({
      transcript: "test transcript",
      summary: "test summary",
      post_call_analysis: { foo: "bar" },
    });

    await executeHousecallPro(callLog, "client-1", {});

    expect(mockExtractStructuredData).toHaveBeenCalledWith(
      "test transcript",
      "test summary",
      { foo: "bar" }
    );
  });
});
