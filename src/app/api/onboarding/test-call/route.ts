import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  // 1. Find the agent for this client
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, retell_agent_id, retell_api_key_encrypted, organization_id, client_id")
    .eq("client_id", clientId)
    .limit(1)
    .single();

  if (agentError || !agent) {
    return NextResponse.json(
      { error: "No agent found for this client. Please create an agent first." },
      { status: 404 }
    );
  }

  // Resolve the Retell API key
  const retellApiKey =
    (agent.retell_api_key_encrypted ? decrypt(agent.retell_api_key_encrypted) : null) ||
    (await getIntegrationKey(agent.organization_id, "retell")) ||
    process.env.RETELL_API_KEY;

  if (!retellApiKey) {
    return NextResponse.json(
      { error: "No Retell API key configured" },
      { status: 500 }
    );
  }

  // 2. Increment test_calls_used in client_onboarding
  const { error: incrementError } = await supabase.rpc("increment_field", {
    table_name: "client_onboarding",
    field_name: "test_calls_used",
    row_client_id: clientId,
  });

  // If the RPC doesn't exist, fall back to a manual update
  if (incrementError) {
    const { data: onboarding } = await supabase
      .from("client_onboarding")
      .select("test_calls_used")
      .eq("client_id", clientId)
      .single();

    await supabase
      .from("client_onboarding")
      .update({
        test_calls_used: (onboarding?.test_calls_used ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", clientId);
  }

  // 3. Create web call via Retell API
  try {
    const retellRes = await fetch("https://api.retellai.com/v2/create-web-call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${retellApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agent.retell_agent_id,
        metadata: {
          source: "onboarding_test",
          internal_agent_id: agent.id,
          client_id: agent.client_id,
          organization_id: agent.organization_id,
        },
      }),
    });

    if (!retellRes.ok) {
      return NextResponse.json(
        { error: "Failed to create test call" },
        { status: retellRes.status }
      );
    }

    const data = await retellRes.json();

    // 4. Return the web call credentials
    return NextResponse.json({
      access_token: data.access_token,
      call_id: data.call_id,
    });
  } catch (err) {
    console.error("Test call error:", err);
    return NextResponse.json(
      { error: "Failed to create test call" },
      { status: 500 }
    );
  }
}
