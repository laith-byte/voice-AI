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

  const { message } = await request.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // Get the SMS/chat agent for this client
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("retell_agent_id, retell_api_key_encrypted, organization_id, platform")
    .eq("client_id", clientId)
    .in("platform", ["retell-sms", "retell-chat"])
    .limit(1)
    .single();

  if (agentError || !agent) {
    return NextResponse.json(
      { error: "No agent found. Please complete agent setup first." },
      { status: 404 }
    );
  }

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

  try {
    // Verify the agent exists on Retell by fetching its config
    const agentEndpoint = agent.platform === "retell-sms" || agent.platform === "retell-chat"
      ? `https://api.retellai.com/get-chat-agent/${agent.retell_agent_id}`
      : `https://api.retellai.com/get-agent/${agent.retell_agent_id}`;

    const verifyRes = await fetch(agentEndpoint, {
      method: "GET",
      headers: { Authorization: `Bearer ${retellApiKey}` },
    });

    if (!verifyRes.ok) {
      return NextResponse.json({
        response: "Could not verify SMS agent configuration. Please check your agent setup and try again.",
        simulated: true,
        error: true,
      });
    }

    // Agent exists and is configured - return a simulated response
    // Note: Retell does not offer a direct SMS test API; real SMS testing
    // requires sending an actual text to the configured phone number.
    return NextResponse.json({
      response: `Your SMS agent is configured and ready to handle messages. To fully test, send a text message to your configured phone number. Your test message was: "${message.replace(/"/g, "'")}"`,
      simulated: true,
      agent_verified: true,
    });
  } catch (err) {
    console.error("SMS test error:", err);
    return NextResponse.json({
      response: "Failed to verify SMS agent. Please check your configuration.",
      simulated: true,
      error: true,
    });
  }
}
