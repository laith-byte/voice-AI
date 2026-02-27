import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, getClientIp, publicEndpointLimiter, rateLimitExceeded } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// CRITICAL-02: Per-phone rate limit — max 2 calls per phone number per day
const phoneRateLimiter = createRateLimiter({ windowMs: 86_400_000, maxRequests: 2 });

// Map industry slugs to Retell agent IDs
const AGENT_MAP: Record<string, string> = {
  healthcare: process.env.RETELL_AGENT_HEALTHCARE || "",
  legal: process.env.RETELL_AGENT_LEGAL || "",
  "home-services": process.env.RETELL_AGENT_HOME_SERVICES || "",
  "real-estate": process.env.RETELL_AGENT_REAL_ESTATE || "",
  insurance: process.env.RETELL_AGENT_INSURANCE || "",
  "financial-services": process.env.RETELL_AGENT_FINANCIAL || "",
  automotive: process.env.RETELL_AGENT_AUTOMOTIVE || "",
  hospitality: process.env.RETELL_AGENT_HOSPITALITY || "",
};

// Normalize phone number to E.164 format
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed, resetMs } = publicEndpointLimiter.check(ip);
  if (!allowed) return rateLimitExceeded(resetMs);

  try {
    const { industry, callerName, phoneNumber, email, companyName } =
      await request.json();

    // CRITICAL-02: Validate phone number — restrict to US/Canada (+1) only
    if (!phoneNumber || typeof phoneNumber !== "string") {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }
    const e164Phone = toE164(phoneNumber);
    if (!/^\+1\d{10}$/.test(e164Phone)) {
      return NextResponse.json(
        { error: "Only US/Canada phone numbers (+1) are supported for demo calls" },
        { status: 400 }
      );
    }

    // CRITICAL-02: Per-phone rate limit
    const { allowed: phoneAllowed, resetMs: phoneResetMs } = phoneRateLimiter.check(e164Phone);
    if (!phoneAllowed) return rateLimitExceeded(phoneResetMs);

    const retellAgentId = AGENT_MAP[industry];
    if (!retellAgentId) {
      return NextResponse.json(
        { error: "Invalid industry or agent not configured" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RETELL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured. Please check your integrations settings." },
        { status: 500 }
      );
    }

    // RETELL_FROM_NUMBER is a Retell-registered number for marketing demo calls (distinct from TWILIO_FROM_NUMBER used for in-call SMS)
    const fromNumber = process.env.RETELL_FROM_NUMBER;
    if (!fromNumber) {
      return NextResponse.json(
        { error: "Demo phone number not configured" },
        { status: 500 }
      );
    }

    // Create an outbound phone call via Retell API
    const retellRes = await fetch(
      "https://api.retellai.com/v2/create-phone-call",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_number: fromNumber,
          to_number: toE164(phoneNumber),
          agent_id: retellAgentId,
          metadata: {
            source: "website_demo",
            industry,
            caller_name: callerName,
            email,
            company_name: companyName,
          },
          retell_llm_dynamic_variables: {
            caller_name: callerName || "there",
            phone_number: phoneNumber || "",
            email: email || "",
            company_name: companyName || "",
          },
        }),
      }
    );

    if (!retellRes.ok) {
      const errText = await retellRes.text();
      logger.error("Retell API error", { error: errText });
      return NextResponse.json(
        { error: "Failed to create demo call" },
        { status: 502 }
      );
    }

    const data = await retellRes.json();

    return NextResponse.json({ call_id: data.call_id });
  } catch (err) {
    logger.error("Demo call error", { error: String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
