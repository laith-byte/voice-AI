import { describe, it, expect, vi, beforeEach } from "vitest";
import { jobberGraphQL, executeJobber } from "../jobber";

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

function makeCallLog(overrides: Partial<Parameters<typeof executeJobber>[0]> = {}) {
  return {
    id: "log-1",
    retell_call_id: "retell-1",
    from_number: "+15551234567",
    to_number: "+15559876543",
    direction: "inbound",
    status: "completed",
    duration_seconds: 185,
    summary: "Customer needs heating repair",
    started_at: "2026-01-01T00:00:00Z",
    ended_at: "2026-01-01T00:03:05Z",
    post_call_analysis: null,
    transcript: "Hello, my furnace stopped working.",
    ...overrides,
  };
}

const EXTRACTED_DATA = {
  caller_name: "Jane Doe",
  phone: "+15551234567",
  email: "jane@example.com",
  address: "456 Oak Ave",
  service_requested: "Heating Repair",
  urgency: "urgent" as const,
  preferred_time: "Tuesday afternoon",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetValidToken.mockResolvedValue("test-token");
  mockExtractStructuredData.mockReturnValue(EXTRACTED_DATA);
  mockMapServiceToCategory.mockResolvedValue({
    external_category_name: "Heating System Repair",
    external_category_id: "cat-2",
    default_duration_minutes: 90,
    default_price_cents: 8900,
  });
  mockEnqueueRetry.mockResolvedValue(undefined);

  vi.stubGlobal("fetch", vi.fn());
});

describe("jobberGraphQL", () => {
  it("sends POST to Jobber GraphQL endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { clients: { nodes: [] } } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await jobberGraphQL("my-token", "{ clients { nodes { id } } }");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.getjobber.com/api/graphql",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer my-token",
          "Content-Type": "application/json",
          "X-JOBBER-GRAPHQL-VERSION": "2024-12-17",
        }),
      })
    );
  });

  it("sends query and variables in body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await jobberGraphQL("t", "mutation($input: ClientCreateInput!) { clientCreate(input: $input) { client { id } } }", { input: { firstName: "John" } });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.query).toContain("clientCreate");
    expect(body.variables).toEqual({ input: { firstName: "John" } });
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 })
    );

    await expect(jobberGraphQL("bad-token", "{ query }")).rejects.toThrow(
      "Jobber GraphQL request failed: 401"
    );
  });

  it("returns parsed JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { test: true }, errors: [] }),
      })
    );

    const result = await jobberGraphQL("t", "{ test }");
    expect(result.data).toEqual({ test: true });
  });
});

describe("executeJobber", () => {
  it("returns early when from_number is null", async () => {
    await executeJobber(makeCallLog({ from_number: null }), "client-1", {});
    expect(mockGetValidToken).not.toHaveBeenCalled();
  });

  it("enqueues retry and returns on token error", async () => {
    mockGetValidToken.mockRejectedValue(new Error("Token expired"));

    await executeJobber(makeCallLog(), "client-1", {});

    expect(mockEnqueueRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-1",
        provider: "jobber",
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

  it("searches for existing client and creates request", async () => {
    const mockFetch = vi.fn()
      // Client search
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              clients: {
                nodes: [{ id: "node-1", name: { full: "Jane Doe" }, phones: [], emails: [] }],
              },
            },
          }),
      })
      // Request create
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { requestCreate: { request: { id: "req-1" }, userErrors: [] } },
          }),
      });

    vi.stubGlobal("fetch", mockFetch);

    await executeJobber(makeCallLog(), "client-1", {});

    // First call is search, second is request create
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockLogIntegrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "request_created" })
    );
  });

  it("creates new client when search returns empty", async () => {
    const mockFetch = vi.fn()
      // Client search — empty
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ data: { clients: { nodes: [] } } }),
      })
      // Client create
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { clientCreate: { client: { id: "new-node-1" }, userErrors: [] } },
          }),
      })
      // Request create
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { requestCreate: { request: { id: "req-1" }, userErrors: [] } },
          }),
      });

    vi.stubGlobal("fetch", mockFetch);

    await executeJobber(makeCallLog(), "client-1", {});

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockLogIntegrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "client_created" })
    );
    expect(mockLogIntegrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "client_created_and_request_logged" })
    );
  });

  it("throws when client creation fails", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { clients: { nodes: [] } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { clientCreate: { client: null, userErrors: [{ message: "Invalid" }] } },
          }),
      });

    vi.stubGlobal("fetch", mockFetch);

    await expect(executeJobber(makeCallLog(), "client-1", {})).rejects.toThrow(
      "Failed to create Jobber client"
    );
  });

  it("uses service_requested in request title", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { clients: { nodes: [{ id: "n1", name: { full: "X" }, phones: [], emails: [] }] } },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ data: { requestCreate: { request: { id: "r1" }, userErrors: [] } } }),
      });

    vi.stubGlobal("fetch", mockFetch);

    await executeJobber(makeCallLog(), "client-1", {});

    // Check the request create mutation body
    const requestBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(requestBody.variables.input.title).toContain("Heating Repair");
  });

  it("enqueues retry on transient GraphQL error (429)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 429 })
    );

    await expect(executeJobber(makeCallLog(), "client-1", {})).rejects.toThrow();

    expect(mockEnqueueRetry).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "jobber" })
    );
  });

  it("enqueues retry on 503 error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 503 })
    );

    await expect(executeJobber(makeCallLog(), "client-1", {})).rejects.toThrow();

    expect(mockEnqueueRetry).toHaveBeenCalled();
  });

  it("does not enqueue retry on non-transient error", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { clients: { nodes: [] } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ data: { clientCreate: { client: null } } }),
      });

    vi.stubGlobal("fetch", mockFetch);

    await expect(executeJobber(makeCallLog(), "client-1", {})).rejects.toThrow();

    // enqueueRetry should not be called from the catch block (error msg doesn't contain 429/500/503)
    const retryCalls = mockEnqueueRetry.mock.calls.filter(
      (call) => call[0]?.action === "post_call_sync"
    );
    expect(retryCalls).toHaveLength(0);
  });

  it("logs sync_failed on error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 500 })
    );

    await expect(executeJobber(makeCallLog(), "client-1", {})).rejects.toThrow();

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
        json: () =>
          Promise.resolve({
            data: { clients: { nodes: [{ id: "n1", name: { full: "X" }, phones: [], emails: [] }] } },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ data: { requestCreate: { request: { id: "r1" }, userErrors: [] } } }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const callLog = makeCallLog({
      transcript: "my transcript",
      summary: "my summary",
      post_call_analysis: { analysis: true },
    });

    await executeJobber(callLog, "client-1", {});

    expect(mockExtractStructuredData).toHaveBeenCalledWith(
      "my transcript",
      "my summary",
      { analysis: true }
    );
  });

  it("falls back to Unknown/Caller when caller_name is missing", async () => {
    mockExtractStructuredData.mockReturnValue({
      ...EXTRACTED_DATA,
      caller_name: null,
      email: null,
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { clients: { nodes: [] } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { clientCreate: { client: { id: "new-1" }, userErrors: [] } },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ data: { requestCreate: { request: { id: "r1" }, userErrors: [] } } }),
      });

    vi.stubGlobal("fetch", mockFetch);

    await executeJobber(makeCallLog(), "client-1", {});

    // Check clientCreate mutation variables
    const createBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(createBody.variables.input.firstName).toBe("Unknown");
    expect(createBody.variables.input.lastName).toBe("Caller");
  });
});
