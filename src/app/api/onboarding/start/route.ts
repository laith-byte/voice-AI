import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const body = await request.json();
  const { vertical_template_id, agent_type } = body;

  if (!vertical_template_id) {
    return NextResponse.json(
      { error: "vertical_template_id is required" },
      { status: 400 }
    );
  }

  // Upsert: create new onboarding record or reset an existing one
  const { data, error } = await supabase
    .from("client_onboarding")
    .upsert(
      {
        client_id: clientId,
        status: "in_progress",
        current_step: 1,
        vertical_template_id,
        agent_type: agent_type || "voice",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}
