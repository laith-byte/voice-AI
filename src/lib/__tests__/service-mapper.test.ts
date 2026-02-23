import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapServiceToCategory } from "../service-mapper";

const mockSelect = vi.fn();
const mockEq1 = vi.fn();
const mockEq2 = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() =>
    Promise.resolve({
      from: () => ({
        select: (...args: unknown[]) => {
          mockSelect(...args);
          return {
            eq: (col1: string, val1: string) => {
              mockEq1(col1, val1);
              return {
                eq: (col2: string, val2: string) => {
                  mockEq2(col2, val2);
                  return mockQueryResult;
                },
              };
            },
          };
        },
      }),
    })
  ),
}));

let mockQueryResult: { data: unknown[] | null } = { data: null };

const SAMPLE_MAPPINGS = [
  {
    internal_service_name: "AC Repair",
    external_category_id: "cat-1",
    external_category_name: "Air Conditioning Repair",
    default_duration_minutes: 90,
    default_price_cents: 8900,
  },
  {
    internal_service_name: "Maintenance & Tune-Up",
    external_category_id: "cat-2",
    external_category_name: "HVAC Maintenance",
    default_duration_minutes: 60,
    default_price_cents: 7900,
  },
  {
    internal_service_name: "Duct Work",
    external_category_id: "cat-3",
    external_category_name: "Ductwork Services",
    default_duration_minutes: null,
    default_price_cents: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryResult = { data: SAMPLE_MAPPINGS };
});

describe("mapServiceToCategory", () => {
  it("returns null when serviceRequested is null", async () => {
    const result = await mapServiceToCategory("client-1", "housecallpro", null);
    expect(result).toBeNull();
  });

  it("returns null when serviceRequested is empty string", async () => {
    const result = await mapServiceToCategory("client-1", "housecallpro", "");
    expect(result).toBeNull();
  });

  it("returns null when no mappings exist for client", async () => {
    mockQueryResult = { data: [] };
    const result = await mapServiceToCategory("client-1", "housecallpro", "AC Repair");
    expect(result).toBeNull();
  });

  it("returns null when query returns null data", async () => {
    mockQueryResult = { data: null };
    const result = await mapServiceToCategory("client-1", "housecallpro", "AC Repair");
    expect(result).toBeNull();
  });

  it("finds exact match (case-insensitive)", async () => {
    const result = await mapServiceToCategory("client-1", "housecallpro", "ac repair");
    expect(result).toEqual({
      external_category_id: "cat-1",
      external_category_name: "Air Conditioning Repair",
      default_duration_minutes: 90,
      default_price_cents: 8900,
    });
  });

  it("finds exact match with extra whitespace", async () => {
    const result = await mapServiceToCategory("client-1", "housecallpro", "  AC Repair  ");
    expect(result).toEqual({
      external_category_id: "cat-1",
      external_category_name: "Air Conditioning Repair",
      default_duration_minutes: 90,
      default_price_cents: 8900,
    });
  });

  it("finds fuzzy match when request contains mapping name", async () => {
    const result = await mapServiceToCategory(
      "client-1",
      "housecallpro",
      "I need AC Repair for my home"
    );
    expect(result?.external_category_name).toBe("Air Conditioning Repair");
  });

  it("finds fuzzy match when mapping name contains request", async () => {
    const result = await mapServiceToCategory("client-1", "housecallpro", "duct");
    expect(result?.external_category_name).toBe("Ductwork Services");
  });

  it("returns null when no match found", async () => {
    const result = await mapServiceToCategory("client-1", "housecallpro", "Pool cleaning");
    expect(result).toBeNull();
  });

  it("defaults duration to 60 when null in mapping", async () => {
    const result = await mapServiceToCategory("client-1", "housecallpro", "Duct Work");
    expect(result?.default_duration_minutes).toBe(60);
  });

  it("queries with correct client_id and provider", async () => {
    await mapServiceToCategory("my-client", "jobber", "AC Repair");
    expect(mockEq1).toHaveBeenCalledWith("client_id", "my-client");
    expect(mockEq2).toHaveBeenCalledWith("provider", "jobber");
  });
});
