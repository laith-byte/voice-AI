import { describe, it, expect, vi, beforeEach } from "vitest";
import { logIntegrationEvent } from "../integration-events";

const mockInsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() =>
    Promise.resolve({
      from: (table: string) => {
        expect(table).toBe("integration_events");
        return { insert: mockInsert };
      },
    })
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
});

describe("logIntegrationEvent", () => {
  it("inserts event with required fields", async () => {
    logIntegrationEvent({
      client_id: "client-1",
      provider: "housecallpro",
      event_type: "customer_created",
    });

    // Fire-and-forget — wait for microtask queue
    await new Promise((r) => setTimeout(r, 10));

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "client-1",
        provider: "housecallpro",
        event_type: "customer_created",
      })
    );
  });

  it("defaults direction to outbound", async () => {
    logIntegrationEvent({
      client_id: "c",
      provider: "jobber",
      event_type: "request_created",
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ direction: "outbound" })
    );
  });

  it("defaults status to success", async () => {
    logIntegrationEvent({
      client_id: "c",
      provider: "jobber",
      event_type: "request_created",
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success" })
    );
  });

  it("passes through all optional fields", async () => {
    logIntegrationEvent({
      client_id: "c",
      provider: "housecallpro",
      event_type: "sync_failed",
      direction: "inbound",
      entity_type: "job",
      entity_id: "job-123",
      call_log_id: "call-456",
      status: "failed",
      error_message: "API timeout",
      metadata: { retryCount: 3 },
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: "inbound",
        entity_type: "job",
        entity_id: "job-123",
        call_log_id: "call-456",
        status: "failed",
        error_message: "API timeout",
        metadata: { retryCount: 3 },
      })
    );
  });

  it("sets null for missing optional fields", async () => {
    logIntegrationEvent({
      client_id: "c",
      provider: "jobber",
      event_type: "test",
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: null,
        entity_id: null,
        call_log_id: null,
        error_message: null,
        metadata: {},
      })
    );
  });

  it("does not throw on insert error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInsert.mockResolvedValue({ error: { message: "DB down" } });

    logIntegrationEvent({
      client_id: "c",
      provider: "jobber",
      event_type: "test",
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(consoleSpy).toHaveBeenCalledWith(
      "integration_events insert error:",
      expect.anything()
    );
    consoleSpy.mockRestore();
  });
});
