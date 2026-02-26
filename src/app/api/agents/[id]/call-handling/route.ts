import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { decrypt } from "@/lib/crypto";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id: agentId } = await params;

  // Verify agent exists and user has access
  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, organization_id, retell_agent_id, retell_api_key_encrypted")
    .eq("id", agentId)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData || userData.organization_id !== agent.organization_id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data, error: fetchError } = await supabase
    .from("agent_call_handling")
    .select("*")
    .eq("agent_id", agentId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    return NextResponse.json({ error: "Failed to fetch call handling settings" }, { status: 500 });
  }

  return NextResponse.json(data || {
    after_hours_behavior: "take_message",
    unanswerable_behavior: "take_message",
    escalation_phone: null,
    max_call_duration_minutes: 15,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id: agentId } = await params;

  // Verify agent exists and user has access
  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, organization_id, client_id, retell_agent_id, retell_api_key_encrypted, platform")
    .eq("id", agentId)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData || userData.organization_id !== agent.organization_id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await request.json();

  const ALLOWED_FIELDS = [
    "after_hours_behavior", "unanswerable_behavior",
    "escalation_phone", "max_call_duration_minutes",
  ];
  const safeUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ALLOWED_FIELDS) {
    if (key in body) safeUpdate[key] = body[key];
  }

  const { data, error: upsertError } = await supabase
    .from("agent_call_handling")
    .upsert(
      {
        agent_id: agentId,
        client_id: agent.client_id,
        ...safeUpdate,
      },
      { onConflict: "agent_id" }
    )
    .select()
    .single();

  if (upsertError) {
    console.error("DB error:", upsertError.message);
    return NextResponse.json({ error: "Failed to save call handling settings" }, { status: 500 });
  }

  // Push max_call_duration to Retell agent config
  if (safeUpdate.max_call_duration_minutes !== undefined && agent.retell_agent_id) {
    const isChat = agent.platform === "retell-chat" || agent.platform === "retell-sms";
    if (!isChat) {
      try {
        const apiKey = agent.retell_api_key_encrypted
          ? decrypt(agent.retell_api_key_encrypted)
          : process.env.RETELL_API_KEY;

        if (apiKey) {
          await fetch(`https://api.retellai.com/update-agent/${agent.retell_agent_id}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              max_call_duration_ms: (safeUpdate.max_call_duration_minutes as number) * 60 * 1000,
            }),
          });
        }
      } catch (err) {
        console.error("Failed to push max_call_duration to Retell:", err);
      }
    }
  }

  return NextResponse.json(data);
}
