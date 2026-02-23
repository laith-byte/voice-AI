import { describe, it, expect } from "vitest";
import { extractStructuredData, classifyUrgency } from "../transcript-extraction";

describe("classifyUrgency", () => {
  it("returns emergency for gas leak", () => {
    expect(classifyUrgency("I smell a gas leak in my basement")).toBe("emergency");
  });

  it("returns emergency for carbon monoxide", () => {
    expect(classifyUrgency("Our carbon monoxide detector is going off")).toBe("emergency");
  });

  it("returns emergency for burning smell", () => {
    expect(classifyUrgency("There's a burning smell from the furnace")).toBe("emergency");
  });

  it("returns urgent for no heat", () => {
    expect(classifyUrgency("We have no heat and it's freezing")).toBe("urgent");
  });

  it("returns urgent for broken ac", () => {
    expect(classifyUrgency("Our broken ac needs fixing")).toBe("urgent");
  });

  it("returns urgent for asap", () => {
    expect(classifyUrgency("We need someone asap")).toBe("urgent");
  });

  it("returns routine for normal requests", () => {
    expect(classifyUrgency("I'd like to schedule a tune-up next week")).toBe("routine");
  });

  it("returns routine for empty text", () => {
    expect(classifyUrgency("")).toBe("routine");
  });

  it("is case-insensitive", () => {
    expect(classifyUrgency("GAS LEAK IN THE HOUSE")).toBe("emergency");
  });

  it("prioritizes emergency over urgent keywords", () => {
    expect(classifyUrgency("gas leak and no heat situation")).toBe("emergency");
  });
});

describe("extractStructuredData", () => {
  it("returns all-null defaults with no inputs", () => {
    const result = extractStructuredData(null, null, null);
    expect(result).toEqual({
      caller_name: null,
      phone: null,
      email: null,
      address: null,
      service_requested: null,
      urgency: "routine",
      preferred_time: null,
    });
  });

  describe("post_call_analysis extraction", () => {
    it("extracts from custom_analysis_data", () => {
      const analysis = {
        custom_analysis_data: {
          caller_name: "John Smith",
          phone_number: "555-123-4567",
          email: "john@example.com",
          address: "123 Main St",
          service_requested: "AC Repair",
          urgency: "urgent",
          preferred_time: "Monday morning",
        },
      };
      const result = extractStructuredData(null, null, analysis);
      expect(result.caller_name).toBe("John Smith");
      expect(result.phone).toBe("555-123-4567");
      expect(result.email).toBe("john@example.com");
      expect(result.address).toBe("123 Main St");
      expect(result.service_requested).toBe("AC Repair");
      expect(result.urgency).toBe("urgent");
      expect(result.preferred_time).toBe("Monday morning");
    });

    it("extracts from top-level analysis when no custom_analysis_data", () => {
      const analysis = {
        caller_name: "Jane Doe",
        email: "jane@example.com",
      };
      const result = extractStructuredData(null, null, analysis);
      expect(result.caller_name).toBe("Jane Doe");
      expect(result.email).toBe("jane@example.com");
    });

    it("uses alternate field names (customer_name, service_address, etc.)", () => {
      const analysis = {
        custom_analysis_data: {
          customer_name: "Bob Jones",
          phone: "555-999-8888",
          service_address: "456 Oak Ave",
          service_type: "Furnace Install",
          preferred_date: "Next Tuesday",
        },
      };
      const result = extractStructuredData(null, null, analysis);
      expect(result.caller_name).toBe("Bob Jones");
      expect(result.phone).toBe("555-999-8888");
      expect(result.address).toBe("456 Oak Ave");
      expect(result.service_requested).toBe("Furnace Install");
      expect(result.preferred_time).toBe("Next Tuesday");
    });

    it("uses reason_for_call as fallback for service_requested", () => {
      const analysis = {
        custom_analysis_data: {
          reason_for_call: "Thermostat replacement",
        },
      };
      const result = extractStructuredData(null, null, analysis);
      expect(result.service_requested).toBe("Thermostat replacement");
    });

    it("uses appointment_time as fallback for preferred_time", () => {
      const analysis = {
        custom_analysis_data: {
          appointment_time: "3pm Friday",
        },
      };
      const result = extractStructuredData(null, null, analysis);
      expect(result.preferred_time).toBe("3pm Friday");
    });

    it("validates urgency enum value", () => {
      const analysis = { custom_analysis_data: { urgency: "Emergency" } };
      const result = extractStructuredData(null, null, analysis);
      expect(result.urgency).toBe("emergency");
    });

    it("ignores invalid urgency values", () => {
      const analysis = { custom_analysis_data: { urgency: "critical" } };
      const result = extractStructuredData(null, null, analysis);
      expect(result.urgency).toBe("routine");
    });
  });

  describe("transcript regex fallback", () => {
    it("extracts email from transcript", () => {
      const transcript = "My email is customer@hvacservice.com and I need help";
      const result = extractStructuredData(transcript, null, null);
      expect(result.email).toBe("customer@hvacservice.com");
    });

    it("extracts phone from transcript", () => {
      const transcript = "You can reach me at (555) 123-4567";
      const result = extractStructuredData(transcript, null, null);
      expect(result.phone).toBe("(555) 123-4567");
    });

    it("extracts address from transcript", () => {
      const transcript = "I live at 742 Evergreen Avenue in Springfield";
      const result = extractStructuredData(transcript, null, null);
      expect(result.address).toBe("742 Evergreen Avenue");
    });

    it("does not override analysis data with transcript regex", () => {
      const analysis = { email: "from-analysis@test.com" };
      const transcript = "My email is from-transcript@test.com";
      const result = extractStructuredData(transcript, null, analysis);
      expect(result.email).toBe("from-analysis@test.com");
    });
  });

  describe("urgency from transcript", () => {
    it("classifies urgency from transcript when analysis has no urgency", () => {
      const result = extractStructuredData("There is a gas leak", null, null);
      expect(result.urgency).toBe("emergency");
    });

    it("classifies urgency from summary text", () => {
      const result = extractStructuredData(null, "Customer reports no heat", null);
      expect(result.urgency).toBe("urgent");
    });

    it("does not override analysis urgency with transcript classification", () => {
      const analysis = { urgency: "routine" };
      const result = extractStructuredData("gas leak emergency", null, analysis);
      expect(result.urgency).toBe("routine");
    });
  });

  describe("service from summary fallback", () => {
    it("uses summary as service_requested when not set", () => {
      const result = extractStructuredData(null, "AC repair needed", null);
      expect(result.service_requested).toBe("AC repair needed");
    });

    it("truncates long summaries to 200 chars", () => {
      const longSummary = "A".repeat(300);
      const result = extractStructuredData(null, longSummary, null);
      expect(result.service_requested).toHaveLength(200);
    });

    it("does not override analysis service_requested with summary", () => {
      const analysis = { service_requested: "Duct Cleaning" };
      const result = extractStructuredData(null, "General inquiry", analysis);
      expect(result.service_requested).toBe("Duct Cleaning");
    });
  });
});
