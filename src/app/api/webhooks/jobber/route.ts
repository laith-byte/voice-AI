import { NextRequest, NextResponse } from "next/server";
import { logIntegrationEvent } from "@/lib/integration-events";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.topic || body.event || "unknown";

    // Log to integration_events table
    logIntegrationEvent({
      client_id: body.account_id || "unknown",
      provider: "jobber",
      event_type: eventType,
      direction: "inbound",
      entity_type: body.resource_type || null,
      entity_id: body.resource_id?.toString() || null,
      status: "success",
      metadata: body,
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("Jobber webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 200 });
  }
}
