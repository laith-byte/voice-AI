import { describe, it, expect } from "vitest";
import {
  HVAC_SERVICE_CATEGORIES,
  HVAC_URGENCY_RULES,
  getHvacServiceMapping,
} from "../hvac-templates";

describe("HVAC_SERVICE_CATEGORIES", () => {
  it("has exactly 9 categories", () => {
    expect(HVAC_SERVICE_CATEGORIES).toHaveLength(9);
  });

  it("includes all expected service names", () => {
    const names = HVAC_SERVICE_CATEGORIES.map((c) => c.name);
    expect(names).toContain("AC Repair");
    expect(names).toContain("AC Installation");
    expect(names).toContain("Heating Repair");
    expect(names).toContain("Furnace Installation");
    expect(names).toContain("Maintenance & Tune-Up");
    expect(names).toContain("Duct Work");
    expect(names).toContain("Thermostat");
    expect(names).toContain("Indoor Air Quality");
    expect(names).toContain("Emergency Service");
  });

  it("every category has a non-empty keywords array", () => {
    for (const cat of HVAC_SERVICE_CATEGORIES) {
      expect(cat.keywords.length).toBeGreaterThan(0);
    }
  });

  it("every category has a positive defaultDurationMinutes", () => {
    for (const cat of HVAC_SERVICE_CATEGORIES) {
      expect(cat.defaultDurationMinutes).toBeGreaterThan(0);
    }
  });

  it("installation categories have null price (requires custom quote)", () => {
    const acInstall = HVAC_SERVICE_CATEGORIES.find((c) => c.name === "AC Installation");
    const furnaceInstall = HVAC_SERVICE_CATEGORIES.find((c) => c.name === "Furnace Installation");
    expect(acInstall?.defaultPriceCents).toBeNull();
    expect(furnaceInstall?.defaultPriceCents).toBeNull();
  });

  it("repair categories have a default price", () => {
    const acRepair = HVAC_SERVICE_CATEGORIES.find((c) => c.name === "AC Repair");
    const heatingRepair = HVAC_SERVICE_CATEGORIES.find((c) => c.name === "Heating Repair");
    expect(acRepair?.defaultPriceCents).toBe(8900);
    expect(heatingRepair?.defaultPriceCents).toBe(8900);
  });
});

describe("HVAC_URGENCY_RULES", () => {
  it("has exactly 3 rules", () => {
    expect(HVAC_URGENCY_RULES).toHaveLength(3);
  });

  it("covers all urgency levels", () => {
    const levels = HVAC_URGENCY_RULES.map((r) => r.level);
    expect(levels).toContain("emergency");
    expect(levels).toContain("urgent");
    expect(levels).toContain("routine");
  });

  it("emergency rule has life-safety keywords", () => {
    const emergency = HVAC_URGENCY_RULES.find((r) => r.level === "emergency")!;
    expect(emergency.keywords).toContain("gas leak");
    expect(emergency.keywords).toContain("carbon monoxide");
    expect(emergency.keywords).toContain("burning smell");
  });

  it("urgent rule has comfort-critical keywords", () => {
    const urgent = HVAC_URGENCY_RULES.find((r) => r.level === "urgent")!;
    expect(urgent.keywords).toContain("no heat");
    expect(urgent.keywords).toContain("no cooling");
    expect(urgent.keywords).toContain("system down");
  });

  it("every rule has a responseTime string", () => {
    for (const rule of HVAC_URGENCY_RULES) {
      expect(rule.responseTime).toBeTruthy();
    }
  });
});

describe("getHvacServiceMapping", () => {
  it("returns one mapping per service category", () => {
    const mappings = getHvacServiceMapping("housecallpro");
    expect(mappings).toHaveLength(HVAC_SERVICE_CATEGORIES.length);
  });

  it("maps internalName to externalName 1:1", () => {
    const mappings = getHvacServiceMapping("jobber");
    for (const mapping of mappings) {
      expect(mapping.internalName).toBe(mapping.externalName);
    }
  });

  it("sets externalId to undefined (no external IDs by default)", () => {
    const mappings = getHvacServiceMapping("housecallpro");
    for (const mapping of mappings) {
      expect(mapping.externalId).toBeUndefined();
    }
  });

  it("returns same structure regardless of provider", () => {
    const hcp = getHvacServiceMapping("housecallpro");
    const jobber = getHvacServiceMapping("jobber");
    expect(hcp).toEqual(jobber);
  });
});
