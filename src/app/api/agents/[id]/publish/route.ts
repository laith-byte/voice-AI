import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";

export async function POST(
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
      `https://api.retellai.com/publish-agent/${agent.retell_agent_id}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${retellApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Retell publish error:", err);
      return NextResponse.json({ error: "Failed to publish agent" }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to publish agent" }, { status: 500 });
  }
}
