import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logIntegrationEvent } from "@/lib/integration-events";

export async function POST(request: NextRequest) {
  // W3: Verify webhook secret
  const secret = request.headers.get("x-webhook-secret") ||
    new URL(request.url).searchParams.get("secret");
  if (!secret || secret !== process.env.HOUSECALLPRO_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const eventType = body.event || body.type || "unknown";

    // W1: Look up client_id from oauth_connections using provider metadata
    const companyId = body.company_id || body.company?.id;
    if (!companyId) {
      console.warn("HCP webhook missing company_id, skipping event log");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const supabase = await createServiceClient();
    const { data: connection } = await supabase
      .from("oauth_connections")
      .select("client_id")
      .eq("provider", "housecallpro")
      .filter("provider_metadata->>company_id", "eq", companyId)
      .limit(1)
      .maybeSingle();

    if (!connection?.client_id) {
      console.warn(`HCP webhook: no oauth_connection found for company_id=${companyId}`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    logIntegrationEvent({
      client_id: connection.client_id,
      provider: "housecallpro",
      event_type: eventType,
      direction: "inbound",
      entity_type: body.resource_type || null,
      entity_id: body.resource_id?.toString() || null,
      status: "success",
      metadata: body,
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("Housecall Pro webhook error:", err);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
