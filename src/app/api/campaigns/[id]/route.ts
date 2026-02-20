import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

const ALLOWED_FIELDS = new Set([
  "name", "status", "start_date",
  "calling_days", "calling_hours_start", "calling_hours_end",
  "timezone_mode", "timezone",
  "retry_attempts", "retry_interval_hours",
  "calling_rate", "calling_rate_minutes",
  "phone_number_ids", "cycle_numbers",
]);

const VALID_STATUSES = new Set(["draft", "active", "paused", "completed"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id } = await params;
  const body = await request.json();

  // Only allow safe fields
  const safeBody: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key)) safeBody[key] = body[key];
  }

  if (Object.keys(safeBody).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Validate status if provided
  if (safeBody.status && !VALID_STATUSES.has(safeBody.status as string)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("campaigns")
    .update(safeBody)
    .eq("id", id)
    .eq("organization_id", userData.organization_id)
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id } = await params;

  // Fetch campaign to check status
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("status")
    .eq("id", id)
    .eq("organization_id", userData.organization_id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.status === "active") {
    return NextResponse.json({ error: "Cannot delete an active campaign. Pause it first." }, { status: 400 });
  }

  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", id)
    .eq("organization_id", userData.organization_id);

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
