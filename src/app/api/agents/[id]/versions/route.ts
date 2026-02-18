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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const { version } = await request.json();

  if (typeof version !== "number") {
    return NextResponse.json({ error: "Version number required" }, { status: 400 });
  }

  const { data: agent, error } = await supabase
    .from("agents")
    .select("retell_agent_id, retell_llm_id, retell_api_key_encrypted, organization_id")
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
    // Fetch all versions to find the target
    const versionsRes = await fetch(
      `https://api.retellai.com/get-agent-versions/${agent.retell_agent_id}`,
      { headers: { Authorization: `Bearer ${retellApiKey}` } }
    );

    if (!versionsRes.ok) {
      return NextResponse.json({ error: "Failed to fetch versions" }, { status: versionsRes.status });
    }

    const versions = await versionsRes.json();
    const target = (Array.isArray(versions) ? versions : []).find(
      (v: Record<string, unknown>) => v.version === version
    );

    if (!target) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // Apply agent-level config (voice, language, etc.)
    const agentPayload: Record<string, unknown> = {};
    if (target.voice_id) agentPayload.voice_id = target.voice_id;
    if (target.language) agentPayload.language = target.language;
    if (target.webhook_url !== undefined) agentPayload.webhook_url = target.webhook_url;

    if (Object.keys(agentPayload).length > 0) {
      await fetch(`https://api.retellai.com/update-agent/${agent.retell_agent_id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${retellApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(agentPayload),
      });
    }

    // Apply LLM config from version
    if (target.response_engine?.llm && agent.retell_llm_id) {
      const llmConfig = target.response_engine.llm;
      const llmPayload: Record<string, unknown> = {};
      if (llmConfig.model) llmPayload.model = llmConfig.model;
      if (llmConfig.general_prompt !== undefined) llmPayload.general_prompt = llmConfig.general_prompt;
      if (llmConfig.general_tools) llmPayload.general_tools = llmConfig.general_tools;
      if (llmConfig.states) llmPayload.states = llmConfig.states;

      if (Object.keys(llmPayload).length > 0) {
        await fetch(`https://api.retellai.com/update-retell-llm/${agent.retell_llm_id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${retellApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(llmPayload),
        });
      }
    }

    return NextResponse.json({ success: true, restored_version: version });
  } catch (err) {
    console.error("Failed to restore version:", err);
    return NextResponse.json({ error: "Failed to restore version" }, { status: 500 });
  }
}
