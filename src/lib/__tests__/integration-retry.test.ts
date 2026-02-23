import { describe, it, expect, vi, beforeEach } from "vitest";
import { enqueueRetry, processRetryQueue } from "../integration-retry";

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const _mockSelect = vi.fn();
const mockExecuteNativeRecipe = vi.fn();

// Build a chainable query mock for processRetryQueue
function buildSelectChain(result: { data: unknown[] | null; error: unknown }) {
  return {
    select: () => ({
      eq: () => ({
        lte: () => ({
          order: () => ({
            limit: () => Promise.resolve(result),
          }),
        }),
      }),
    }),
    update: (data: unknown) => {
      mockUpdate(data);
      return {
        eq: () => Promise.resolve({ error: null }),
      };
    },
    insert: (data: unknown) => {
      mockInsert(data);
      return Promise.resolve({ error: null });
    },
  };
}

let selectResult: { data: unknown[] | null; error: unknown } = { data: null, error: null };

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() =>
    Promise.resolve({
      from: () => buildSelectChain(selectResult),
    })
  ),
}));

vi.mock("@/lib/oauth/execute-native", () => ({
  executeNativeRecipe: (...args: unknown[]) => mockExecuteNativeRecipe(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  selectResult = { data: null, error: null };
  mockInsert.mockClear();
  mockUpdate.mockClear();
  mockExecuteNativeRecipe.mockReset();
});

describe("enqueueRetry", () => {
  it("inserts with default maxAttempts of 5", async () => {
    await enqueueRetry({
      clientId: "client-1",
      provider: "housecallpro",
      action: "post_call_sync",
      payload: { id: "call-1" },
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "client-1",
        provider: "housecallpro",
        action: "post_call_sync",
        payload: { id: "call-1" },
        max_attempts: 5,
        attempt_count: 0,
        status: "pending",
      })
    );
  });

  it("uses custom maxAttempts when provided", async () => {
    await enqueueRetry({
      clientId: "client-1",
      provider: "jobber",
      action: "post_call_sync",
      payload: {},
      maxAttempts: 10,
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ max_attempts: 10 })
    );
  });

  it("logs error on insert failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInsert.mockImplementation(() => ({ error: { message: "DB error" } }));

    await enqueueRetry({
      clientId: "c",
      provider: "p",
      action: "a",
      payload: {},
    });

    consoleSpy.mockRestore();
  });
});

describe("processRetryQueue", () => {
  it("returns 0 when no items are pending", async () => {
    selectResult = { data: [], error: null };
    const count = await processRetryQueue();
    expect(count).toBe(0);
  });

  it("returns 0 on query error", async () => {
    selectResult = { data: null, error: { message: "DB error" } };
    const count = await processRetryQueue();
    expect(count).toBe(0);
  });

  it("executes pending items and returns count", async () => {
    selectResult = {
      data: [
        {
          id: "item-1",
          provider: "housecallpro",
          payload: { id: "call-1" },
          client_id: "client-1",
          attempt_count: 0,
          max_attempts: 5,
        },
      ],
      error: null,
    };
    mockExecuteNativeRecipe.mockResolvedValue(undefined);

    const count = await processRetryQueue();
    expect(count).toBe(1);
    expect(mockExecuteNativeRecipe).toHaveBeenCalledWith(
      "housecallpro",
      { id: "call-1" },
      "client-1",
      {}
    );
  });

  it("marks item as completed on success", async () => {
    selectResult = {
      data: [
        {
          id: "item-1",
          provider: "housecallpro",
          payload: {},
          client_id: "c",
          attempt_count: 0,
          max_attempts: 5,
        },
      ],
      error: null,
    };
    mockExecuteNativeRecipe.mockResolvedValue(undefined);

    await processRetryQueue();

    // update called twice: once for "processing", once for "completed"
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "processing" })
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" })
    );
  });

  it("moves to dead_letter when max attempts reached", async () => {
    selectResult = {
      data: [
        {
          id: "item-1",
          provider: "jobber",
          payload: {},
          client_id: "c",
          attempt_count: 4,
          max_attempts: 5,
        },
      ],
      error: null,
    };
    mockExecuteNativeRecipe.mockRejectedValue(new Error("API error"));

    const count = await processRetryQueue();
    expect(count).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "dead_letter",
        attempt_count: 5,
        last_error: "API error",
      })
    );
  });

  it("schedules retry with backoff on failure before max attempts", async () => {
    selectResult = {
      data: [
        {
          id: "item-1",
          provider: "housecallpro",
          payload: {},
          client_id: "c",
          attempt_count: 1,
          max_attempts: 5,
        },
      ],
      error: null,
    };
    mockExecuteNativeRecipe.mockRejectedValue(new Error("Transient"));

    await processRetryQueue();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        attempt_count: 2,
        last_error: "Transient",
      })
    );
  });

  it("stringifies non-Error thrown values", async () => {
    selectResult = {
      data: [
        {
          id: "item-1",
          provider: "jobber",
          payload: {},
          client_id: "c",
          attempt_count: 4,
          max_attempts: 5,
        },
      ],
      error: null,
    };
    mockExecuteNativeRecipe.mockRejectedValue("string error");

    await processRetryQueue();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ last_error: "string error" })
    );
  });
});
