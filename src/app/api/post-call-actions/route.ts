import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";

// GET — Fetch all post-call actions for the current client
export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error } = await getClientId(user!, supabase, request);
  if (error) return error;

  const agentId = request.nextUrl.searchParams.get("agent_id");

  let query = supabase
    .from("post_call_actions")
    .select("*")
    .eq("client_id", clientId);

  if (agentId) {
    query = query.eq("agent_id", agentId);
  }

  const { data: actions, error: dbError } = await query.order("created_at", {
    ascending: true,
  });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ actions: actions || [] });
}

// PUT — Upsert a post-call action (create or update by action_type)
export async function PUT(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error } = await getClientId(user!, supabase, request);
  if (error) return error;

  const body = await request.json();
  const { action_type, is_enabled, config, agent_id } = body;

  if (!action_type) {
    return NextResponse.json(
      { error: "action_type is required" },
      { status: 400 }
    );
  }

  const validTypes = [
    "email_summary",
    "sms_notification",
    "caller_followup_email",
    "daily_digest",
  ];
  if (!validTypes.includes(action_type)) {
    return NextResponse.json(
      { error: "Invalid action_type" },
      { status: 400 }
    );
  }

  const upsertPayload: Record<string, unknown> = {
    client_id: clientId,
    action_type,
    is_enabled: is_enabled ?? false,
    config: config ?? {},
    updated_at: new Date().toISOString(),
  };
  if (agent_id) {
    upsertPayload.agent_id = agent_id;
  }

  const { data, error: dbError } = await supabase
    .from("post_call_actions")
    .upsert(upsertPayload, { onConflict: "client_id,agent_id,action_type" })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ action: data });
}
