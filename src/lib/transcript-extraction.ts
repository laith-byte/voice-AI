/**
 * Extract structured data from call transcripts and post-call analysis.
 * Used by CRM executors to enrich contact/job records.
 */

interface ExtractedData {
  caller_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  service_requested: string | null;
  urgency: "emergency" | "urgent" | "routine";
  preferred_time: string | null;
}

interface PostCallAnalysis {
  caller_name?: string;
  phone_number?: string;
  email?: string;
  address?: string;
  service_requested?: string;
  urgency?: string;
  preferred_time?: string;
  custom_analysis_data?: Record<string, unknown>;
  [key: string]: unknown;
}

const EMERGENCY_KEYWORDS = [
  "gas leak",
  "carbon monoxide",
  "co detector",
  "co alarm",
  "fire",
  "burning smell",
  "electrical fire",
  "flooding",
  "water everywhere",
  "smoke",
  "explosion",
  "no heat freezing",
  "pipe burst",
  "sparking",
];

const URGENT_KEYWORDS = [
  "no heat",
  "no cooling",
  "no ac",
  "no air conditioning",
  "broken furnace",
  "broken ac",
  "system down",
  "not working at all",
  "completely stopped",
  "water damage",
  "leaking",
  "same day",
  "today",
  "asap",
  "as soon as possible",
  "emergency",
  "urgent",
  "right away",
  "immediately",
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/;
const ADDRESS_REGEX = /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|place|pl|way|circle|cir)\b/i;

/**
 * Extract structured data from call transcript and analysis.
 * Checks post_call_analysis first (Retell AI output), then falls back to
 * regex/keyword matching on the transcript.
 */
export function extractStructuredData(
  transcript: string | null,
  summary: string | null,
  postCallAnalysis: unknown
): ExtractedData {
  const result: ExtractedData = {
    caller_name: null,
    phone: null,
    email: null,
    address: null,
    service_requested: null,
    urgency: "routine",
    preferred_time: null,
  };

  // First: check post_call_analysis (Retell's structured AI output)
  const analysis = postCallAnalysis as PostCallAnalysis | null;
  if (analysis) {
    const customData = analysis.custom_analysis_data || analysis;

    result.caller_name =
      (customData.caller_name as string) ||
      (customData.customer_name as string) ||
      null;
    result.phone =
      (customData.phone_number as string) ||
      (customData.phone as string) ||
      null;
    result.email = (customData.email as string) || null;
    result.address =
      (customData.address as string) ||
      (customData.service_address as string) ||
      null;
    result.service_requested =
      (customData.service_requested as string) ||
      (customData.service_type as string) ||
      (customData.reason_for_call as string) ||
      null;
    result.preferred_time =
      (customData.preferred_time as string) ||
      (customData.preferred_date as string) ||
      (customData.appointment_time as string) ||
      null;

    if (customData.urgency) {
      const u = String(customData.urgency).toLowerCase();
      if (u === "emergency" || u === "urgent" || u === "routine") {
        result.urgency = u;
      }
    }
  }

  // Fall back to transcript/summary extraction for missing fields
  const textToSearch = [transcript, summary].filter(Boolean).join(" ").toLowerCase();

  if (!result.email && transcript) {
    const emailMatch = transcript.match(EMAIL_REGEX);
    if (emailMatch) result.email = emailMatch[0];
  }

  if (!result.phone && transcript) {
    const phoneMatch = transcript.match(PHONE_REGEX);
    if (phoneMatch) result.phone = phoneMatch[0];
  }

  if (!result.address && transcript) {
    const addressMatch = transcript.match(ADDRESS_REGEX);
    if (addressMatch) result.address = addressMatch[0];
  }

  // Classify urgency from transcript if not set by analysis
  if (!analysis?.urgency && textToSearch) {
    result.urgency = classifyUrgency(textToSearch);
  }

  // Extract service from summary if not set
  if (!result.service_requested && summary) {
    result.service_requested = summary.length > 200 ? summary.slice(0, 200) : summary;
  }

  return result;
}

/**
 * Classify urgency based on keywords in text.
 */
export function classifyUrgency(
  text: string
): "emergency" | "urgent" | "routine" {
  const lower = text.toLowerCase();

  for (const keyword of EMERGENCY_KEYWORDS) {
    if (lower.includes(keyword)) return "emergency";
  }

  for (const keyword of URGENT_KEYWORDS) {
    if (lower.includes(keyword)) return "urgent";
  }

  return "routine";
}
