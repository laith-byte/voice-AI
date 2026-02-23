/**
 * HVAC-specific service categories, urgency rules, and default CRM mappings.
 */

export interface HvacServiceCategory {
  name: string;
  description: string;
  defaultDurationMinutes: number;
  defaultPriceCents: number | null;
  keywords: string[];
}

export const HVAC_SERVICE_CATEGORIES: HvacServiceCategory[] = [
  {
    name: "AC Repair",
    description: "Diagnose and repair air conditioning systems",
    defaultDurationMinutes: 90,
    defaultPriceCents: 8900,
    keywords: ["ac repair", "air conditioning repair", "ac not working", "ac broken", "cooling problem", "ac issue"],
  },
  {
    name: "AC Installation",
    description: "New central air conditioning system installation",
    defaultDurationMinutes: 480,
    defaultPriceCents: null,
    keywords: ["ac install", "new ac", "air conditioning installation", "new cooling system", "ac replacement"],
  },
  {
    name: "Heating Repair",
    description: "Furnace, heat pump, and boiler repair",
    defaultDurationMinutes: 90,
    defaultPriceCents: 8900,
    keywords: ["heating repair", "furnace repair", "heater broken", "no heat", "heat pump repair", "boiler repair"],
  },
  {
    name: "Furnace Installation",
    description: "New furnace or heating system installation",
    defaultDurationMinutes: 480,
    defaultPriceCents: null,
    keywords: ["furnace install", "new furnace", "heating installation", "furnace replacement", "new heater"],
  },
  {
    name: "Maintenance & Tune-Up",
    description: "Seasonal HVAC maintenance and system tune-ups",
    defaultDurationMinutes: 60,
    defaultPriceCents: 7900,
    keywords: ["maintenance", "tune-up", "tune up", "checkup", "check-up", "inspection", "annual service", "seasonal"],
  },
  {
    name: "Duct Work",
    description: "Duct cleaning, repair, and installation",
    defaultDurationMinutes: 180,
    defaultPriceCents: null,
    keywords: ["duct", "ductwork", "duct cleaning", "duct repair", "duct installation", "air duct"],
  },
  {
    name: "Thermostat",
    description: "Smart thermostat installation and programming",
    defaultDurationMinutes: 60,
    defaultPriceCents: 14900,
    keywords: ["thermostat", "smart thermostat", "nest", "ecobee", "programmable thermostat"],
  },
  {
    name: "Indoor Air Quality",
    description: "Air purifiers, humidifiers, and filtration systems",
    defaultDurationMinutes: 120,
    defaultPriceCents: null,
    keywords: ["air quality", "air purifier", "humidifier", "dehumidifier", "filtration", "iaq", "air filter", "allergen"],
  },
  {
    name: "Emergency Service",
    description: "24/7 emergency HVAC repair",
    defaultDurationMinutes: 120,
    defaultPriceCents: 14900,
    keywords: ["emergency", "urgent", "after hours", "weekend", "same day emergency"],
  },
];

export interface UrgencyRule {
  level: "emergency" | "urgent" | "routine";
  keywords: string[];
  responseTime: string;
  description: string;
}

export const HVAC_URGENCY_RULES: UrgencyRule[] = [
  {
    level: "emergency",
    keywords: [
      "gas leak",
      "carbon monoxide",
      "co alarm",
      "co detector",
      "burning smell",
      "electrical fire",
      "smoke from",
      "flooding from hvac",
      "water everywhere",
      "sparking",
      "explosion",
    ],
    responseTime: "Immediate — advise 911 first",
    description: "Life-safety hazard requiring immediate emergency response",
  },
  {
    level: "urgent",
    keywords: [
      "no heat",
      "no cooling",
      "no ac",
      "frozen pipe",
      "complete failure",
      "system down",
      "water damage",
      "leaking refrigerant",
      "extreme temperature",
      "elderly",
      "infant",
      "medical condition",
    ],
    responseTime: "Same-day dispatch",
    description: "Critical comfort or property protection issue needing same-day service",
  },
  {
    level: "routine",
    keywords: [
      "maintenance",
      "tune-up",
      "estimate",
      "quote",
      "install",
      "upgrade",
      "noisy",
      "strange sound",
      "efficiency",
      "filter",
    ],
    responseTime: "Next available appointment",
    description: "Non-urgent service that can be scheduled at convenience",
  },
];

interface ProviderMapping {
  internalName: string;
  externalName: string;
  externalId?: string;
}

/**
 * Get default service→CRM category mappings for a provider.
 * Used to pre-populate service_category_mappings for new HVAC clients.
 */
export function getHvacServiceMapping(provider: string): ProviderMapping[] {
  // Default mappings that work for both Housecall Pro and Jobber
  return HVAC_SERVICE_CATEGORIES.map((cat) => ({
    internalName: cat.name,
    externalName: cat.name,
    externalId: undefined,
  }));
}
