import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;

  const { data: agent, error } = await supabase
    .from("agents")
    .select("retell_agent_id, retell_api_key_encrypted, platform, organization_id")
    .eq("id", id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const retellApiKey =
    (agent.retell_api_key_encrypted ? decrypt(agent.retell_api_key_encrypted) : null) ||
    (await getIntegrationKey(agent.organization_id, "retell")) ||
    process.env.RETELL_API_KEY;
  if (!retellApiKey) {
    return NextResponse.json({ error: "No Retell API key configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.retellai.com/get-agent-versions/${agent.retell_agent_id}`,
      {
        headers: {
          Authorization: `Bearer ${retellApiKey}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Retell versions error:", err);
      return NextResponse.json({ error: "Failed to fetch versions" }, { status: res.status });
    }

    const versions = await res.json();

    // Return a simplified version list
    const simplified = (Array.isArray(versions) ? versions : []).map(
      (v: Record<string, unknown>) => ({
        version: v.version,
        is_published: v.is_published,
        llm_model: (v.response_engine as Record<string, unknown>)?.llm
          ? ((v.response_engine as Record<string, Record<string, unknown>>).llm.model as string)
          : null,
        voice_id: v.voice_id,
        created_at: v.last_modification_timestamp,
      })
    );

    return NextResponse.json(simplified);
  } catch {
    return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
  }
}
