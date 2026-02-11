import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";
import { getClientIp, publicEndpointLimiter, rateLimitExceeded } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed, resetMs } = publicEndpointLimiter.check(ip);
  if (!allowed) return rateLimitExceeded(resetMs);

  const supabase = await createClient();
  const body = await request.json();
  const { agent_id } = body;

  if (!agent_id) {
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
  }

  // Get agent's Retell credentials and org/client info
  const { data: agent, error } = await supabase
    .from("agents")
    .select("retell_agent_id, retell_api_key_encrypted, organization_id, client_id")
    .eq("id", agent_id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const retellApiKey = (agent.retell_api_key_encrypted ? decrypt(agent.retell_api_key_encrypted) : null)
    || await getIntegrationKey(agent.organization_id, "retell")
    || process.env.RETELL_API_KEY;
  if (!retellApiKey) {
    return NextResponse.json({ error: "No Retell API key configured" }, { status: 500 });
  }

  try {
    // Create web call via Retell API
    const retellRes = await fetch("https://api.retellai.com/v2/create-web-call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${retellApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agent.retell_agent_id,
        metadata: {
          source: "portal",
          internal_agent_id: agent_id,
          client_id: agent.client_id,
          organization_id: agent.organization_id,
        },
      }),
    });

    if (!retellRes.ok) {
      return NextResponse.json(
        { error: "Failed to create web call" },
        { status: retellRes.status }
      );
    }

    const data = await retellRes.json();
    // Return both access_token and call_id to the client
    return NextResponse.json({
      access_token: data.access_token,
      call_id: data.call_id,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to create web call" },
      { status: 500 }
    );
  }
}
