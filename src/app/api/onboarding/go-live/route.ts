import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { regeneratePrompt } from "@/lib/prompt-generator";

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();

  // 1. Build the completion update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {
    status: "completed",
    completed_at: now,
    go_live_at: now,
    updated_at: now,
  };

  // 2. Save deployment details based on agent type
  if (body.phone_number_option || body.phone_option) {
    updatePayload.phone_number_option = body.phone_number_option || body.phone_option;
  }
  if (body.chat_widget_deployed !== undefined) {
    updatePayload.chat_widget_deployed = body.chat_widget_deployed;
  }
  if (body.sms_phone_configured !== undefined) {
    updatePayload.sms_phone_configured = body.sms_phone_configured;
  }
  if (body.phone_number) {
    updatePayload.phone_number = body.phone_number;
  }

  const { data, error } = await supabase
    .from("client_onboarding")
    .update(updatePayload)
    .eq("client_id", clientId)
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 });
  }

  // 3. Make sure the agent's prompt is up to date
  try {
    await regeneratePrompt(clientId!);
  } catch (promptErr) {
    // Non-fatal: log but don't block the go-live
    console.error("Prompt regeneration failed during go-live:", promptErr);
  }

  return NextResponse.json({ success: true, onboarding: data });
}
