import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const { data, error } = await supabase
    .from("client_onboarding")
    .update({
      status: "in_progress",
      current_step: 1,
      // Clear completion/progress flags so the wizard starts fresh
      completed_at: null,
      go_live_at: null,
      conversation_flow_deployed: false,
      test_call_completed: false,
      test_calls_used: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}
