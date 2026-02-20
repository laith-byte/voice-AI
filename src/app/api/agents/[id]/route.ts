import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";

async function retellFetch(path: string, apiKey: string, options?: RequestInit) {
  return fetch(`https://api.retellai.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
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

  // Verify agent belongs to user's org
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, retell_agent_id, retell_api_key_encrypted, platform, organization_id")
    .eq("id", id)
    .eq("organization_id", userData.organization_id)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Resolve Retell API key using the same chain as agents/[id]/config
  const retellApiKey = (agent.retell_api_key_encrypted ? decrypt(agent.retell_api_key_encrypted) : null)
    || await getIntegrationKey(agent.organization_id, "retell")
    || process.env.RETELL_API_KEY;

  // Delete from Retell API first
  if (retellApiKey && agent.retell_agent_id) {
    try {
      const isChat = agent.platform === "retell-chat" || agent.platform === "retell-sms";
      const endpoint = isChat
        ? `/delete-chat-agent/${agent.retell_agent_id}`
        : `/delete-agent/${agent.retell_agent_id}`;

      const retellRes = await retellFetch(endpoint, retellApiKey, { method: "DELETE" });

      // 404 means already deleted on Retell's side — that's fine
      if (!retellRes.ok && retellRes.status !== 404) {
        const err = await retellRes.text();
        console.error("Retell DELETE error:", err);
        return NextResponse.json(
          { error: "Failed to delete agent from Retell. Please try again." },
          { status: 409 }
        );
      }
    } catch (err) {
      console.error("Retell DELETE network error:", err);
      return NextResponse.json(
        { error: "Failed to reach Retell API. Please try again." },
        { status: 409 }
      );
    }
  }

  // Delete dependent rows, then the agent
  // FK cascades may handle some of these, but explicit cleanup ensures consistency
  const tables = ["call_logs", "campaign_leads", "leads", "campaigns", "widget_config", "conversation_flows"];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("agent_id", id);
    if (error) {
      // campaign_leads may not have agent_id directly — skip gracefully
      console.error(`Cleanup ${table}:`, error.message);
    }
  }

  // Delete the agent row
  const { error: deleteError } = await supabase
    .from("agents")
    .delete()
    .eq("id", id)
    .eq("organization_id", userData.organization_id);

  if (deleteError) {
    console.error("DB error:", deleteError.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
