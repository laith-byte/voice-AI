import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

const VALID_ALERT_TYPES = ["minutes_threshold", "cost_threshold", "calls_threshold"] as const;

export async function GET() {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("client_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.client_id) {
    return NextResponse.json({ error: "No client found" }, { status: 404 });
  }

  const { data: alerts } = await supabase
    .from("usage_alert_settings")
    .select("*")
    .eq("client_id", userData.client_id);

  return NextResponse.json({ alerts: alerts || [] });
}

export async function PUT(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("client_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.client_id) {
    return NextResponse.json({ error: "No client found" }, { status: 404 });
  }

  const body = await request.json();
  const { alert_type, threshold_value, threshold_percent, is_enabled } = body;

  if (!VALID_ALERT_TYPES.includes(alert_type)) {
    return NextResponse.json({ error: "Invalid alert_type" }, { status: 400 });
  }

  if (typeof threshold_value !== "number" || threshold_value < 0) {
    return NextResponse.json({ error: "Invalid threshold_value" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("usage_alert_settings")
    .upsert(
      {
        client_id: userData.client_id,
        alert_type,
        threshold_value,
        threshold_percent: threshold_percent ?? null,
        is_enabled: is_enabled ?? true,
      },
      { onConflict: "client_id,alert_type" }
    )
    .select()
    .single();

  if (error) {
    console.error("Usage alert upsert error:", error);
    return NextResponse.json({ error: "Failed to save alert setting" }, { status: 500 });
  }

  return NextResponse.json({ alert: data });
}
