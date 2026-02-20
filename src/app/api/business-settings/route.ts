import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { regeneratePrompt } from "@/lib/prompt-generator";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  // Try to fetch existing settings
  const { data, error } = await supabase
    .from("business_settings")
    .select("*")
    .eq("client_id", clientId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  // If no row exists, create one with defaults
  if (!data) {
    const { data: created, error: createError } = await supabase
      .from("business_settings")
      .insert({ client_id: clientId })
      .select()
      .single();

    if (createError) {
      console.error("DB error:", createError.message);
      return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }

    return NextResponse.json(created);
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const body = await request.json();

  // Allowlist safe columns to prevent arbitrary column injection
  const ALLOWED_FIELDS = [
    "business_name", "business_phone", "business_website", "business_address",
    "timezone", "contact_name", "contact_email",
    "after_hours_behavior", "unanswerable_behavior", "escalation_phone",
    "max_call_duration_minutes", "post_call_email", "post_call_log",
    "post_call_text", "chat_welcome_message", "chat_offline_behavior",
  ];
  const safeUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ALLOWED_FIELDS) {
    if (key in body) safeUpdate[key] = body[key];
  }

  const { data, error } = await supabase
    .from("business_settings")
    .update(safeUpdate)
    .eq("client_id", clientId)
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  regeneratePrompt(clientId!).catch(err => console.error("Prompt regeneration failed:", err));

  return NextResponse.json(data);
}
