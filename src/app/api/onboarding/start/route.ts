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

  // Check if an onboarding record already exists
  const { data: existing } = await supabase
    .from("client_onboarding")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing) {
    // Update existing record without regressing current_step
    const { data, error } = await supabase
      .from("client_onboarding")
      .update({
        status: "in_progress",
        vertical_template_id,
        agent_type: agent_type || "voice",
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

  // Create new onboarding record
  const { data, error } = await supabase
    .from("client_onboarding")
    .insert({
      client_id: clientId,
      status: "in_progress",
      current_step: 1,
      vertical_template_id,
      agent_type: agent_type || "voice",
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}
