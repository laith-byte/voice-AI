import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.event || body.type || "unknown";

    const supabase = await createServiceClient();

    await supabase.from("integration_events").insert({
      provider: "housecallpro",
      event_type: eventType,
      payload: body,
      status: "received",
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("Housecall Pro webhook error:", err);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
