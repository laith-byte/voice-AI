import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logIntegrationEvent } from "@/lib/integration-events";

export async function POST(request: NextRequest) {
  // W3: Verify webhook secret
  const secret = request.headers.get("x-webhook-secret") ||
    new URL(request.url).searchParams.get("secret");
  if (!secret || secret !== process.env.JOBBER_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const eventType = body.topic || body.event || "unknown";

    // W2: Look up client_id from oauth_connections using account_id
    const accountId = body.account_id;
    if (!accountId) {
      console.warn("Jobber webhook missing account_id, skipping event log");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const supabase = await createServiceClient();
    const { data: connection } = await supabase
      .from("oauth_connections")
      .select("client_id")
      .eq("provider", "jobber")
      .filter("provider_metadata->>account_id", "eq", String(accountId))
      .limit(1)
      .maybeSingle();

    if (!connection?.client_id) {
      console.warn(`Jobber webhook: no oauth_connection found for account_id=${accountId}`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    logIntegrationEvent({
      client_id: connection.client_id,
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
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
