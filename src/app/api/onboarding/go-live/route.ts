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

  // 2. If phone_number_option is provided, save it
  if (body.phone_number_option) {
    updatePayload.phone_number_option = body.phone_number_option;
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
