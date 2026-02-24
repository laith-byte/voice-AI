import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

const SAMPLE_PAYLOAD = {
  call_id: "test_call_123",
  call_status: "completed",
  caller_number: "+15551234567",
  called_number: "+15559876543",
  direction: "inbound",
  duration_seconds: 145,
  summary:
    "Caller inquired about scheduling a consultation. AI agent collected contact information and scheduled a follow-up.",
  transcript: [
    { role: "agent", content: "Hello, thanks for calling! How can I help you today?" },
    { role: "user", content: "Hi, I'd like to schedule a consultation." },
    { role: "agent", content: "Of course! Let me check our availability for you." },
  ],
  recording_url: null,
  started_at: new Date().toISOString(),
  ended_at: new Date(Date.now() + 145000).toISOString(),
  post_call_analysis: {
    intent: "scheduling",
    sentiment: "positive",
  },
  tags: ["new_lead", "consultation"],
  client_id: "test_client",
  recipe_name: "Webhook Test",
  _test: true,
};

export async function POST(request: NextRequest) {
  const { response } = await requireAuth();
  if (response) return response;

  const body = await request.json();
  const { webhook_url } = body;

  if (!webhook_url) {
    return NextResponse.json(
      { error: "webhook_url is required" },
      { status: 400 }
    );
  }

  // SSRF protection: block private/internal URLs
  try {
    const parsed = new URL(webhook_url);
    const hostname = parsed.hostname.toLowerCase();
    if (
      parsed.protocol !== "https:" && parsed.protocol !== "http:" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname === "metadata.google.internal" ||
      hostname === "169.254.169.254"
    ) {
      return NextResponse.json(
        { error: "URL targets a private or internal address" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid URL" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SAMPLE_PAYLOAD),
      signal: AbortSignal.timeout(10000),
    });

    return NextResponse.json({
      success: res.ok,
      status_code: res.status,
      error: res.ok ? null : `HTTP ${res.status}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({
      success: false,
      status_code: null,
      error: message,
    });
  }
}
