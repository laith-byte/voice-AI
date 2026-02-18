import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";
import { computeAgentCost, type AgentCostBreakdown } from "@/lib/retell-costs";

async function retellFetch(path: string, apiKey: string) {
  return fetch(`https://api.retellai.com${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
}

export async function GET() {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  // Get user's organization_id
  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.organization_id) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  const orgId = userData.organization_id;

  // Fetch all agents for this org
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, retell_agent_id, retell_api_key_encrypted, platform, knowledge_base_id, organization_id")
    .eq("organization_id", orgId);

  if (!agents || agents.length === 0) {
    return NextResponse.json({ agents: [], warnings: [] });
  }

  // Resolve Retell API key (same chain as agents/[id]/config)
  const retellApiKey =
    (agents[0].retell_api_key_encrypted ? decrypt(agents[0].retell_api_key_encrypted) : null) ||
    (await getIntegrationKey(orgId, "retell")) ||
    process.env.RETELL_API_KEY;

  if (!retellApiKey) {
    return NextResponse.json({ error: "No Retell API key configured" }, { status: 500 });
  }

  // Fetch voice list once to build voiceId → provider map
  const voiceIdToProvider: Record<string, string> = {};
  try {
    const voicesRes = await retellFetch("/list-voices", retellApiKey);
    if (voicesRes.ok) {
      const voices: Array<{ voice_id: string; provider: string }> = await voicesRes.json();
      for (const v of voices) {
        voiceIdToProvider[v.voice_id] = (v.provider || "openai").toLowerCase();
      }
    }
  } catch {
    // Continue without voice mapping — will default to "openai"
  }

  // Fetch phone numbers once to know which agents have phone connectivity
  const { data: phoneNumbers } = await supabase
    .from("phone_numbers")
    .select("agent_id")
    .eq("organization_id", orgId);

  const agentIdsWithPhone = new Set(
    (phoneNumbers || []).map((p) => p.agent_id).filter(Boolean)
  );

  // Resolve each agent's Retell config in parallel
  const warnings: string[] = [];
  const results = await Promise.allSettled(
    agents
      .filter((a) => a.retell_agent_id) // skip agents without retell config
      .map(async (agent) => {
        // Use agent-specific key if available
        const agentKey = agent.retell_api_key_encrypted
          ? decrypt(agent.retell_api_key_encrypted)
          : retellApiKey;

        const isChat = agent.platform === "retell-chat" || agent.platform === "retell-sms";
        const endpoint = isChat
          ? `/get-chat-agent/${agent.retell_agent_id}`
          : `/get-agent/${agent.retell_agent_id}`;

        const agentRes = await retellFetch(endpoint, agentKey);
        if (!agentRes.ok) {
          throw new Error(`Failed to fetch Retell agent ${agent.retell_agent_id}: ${agentRes.status}`);
        }

        const retellAgent = await agentRes.json();

        // Determine LLM model
        let llmModel = "gpt-4.1";
        const engine = retellAgent.response_engine;
        if (engine?.llm?.model) {
          llmModel = engine.llm.model;
        } else if (engine?.llm_id) {
          try {
            const llmRes = await retellFetch(`/get-retell-llm/${engine.llm_id}`, agentKey);
            if (llmRes.ok) {
              const llmConfig = await llmRes.json();
              llmModel = llmConfig.model || llmModel;
            }
          } catch {
            // Use default
          }
        }

        // Map voice_id → provider
        const voiceId = retellAgent.voice_id || "";
        const voiceProvider = voiceIdToProvider[voiceId] || "openai";

        // Check for add-ons
        const hasKnowledgeBase = !!agent.knowledge_base_id;
        const hasAdvancedDenoising = retellAgent.denoising_mode === "advanced";
        const hasPiiRemoval = !!retellAgent.pii_config;

        // Check if this agent has phone connectivity
        const isPhoneCall = agentIdsWithPhone.has(agent.id) || !isChat;

        return computeAgentCost({
          agentId: agent.id,
          agentName: agent.name || "Unnamed Agent",
          llmModel,
          voiceProvider,
          isPhoneCall,
          hasKnowledgeBase,
          hasAdvancedDenoising,
          hasPiiRemoval,
        });
      })
  );

  const agentCosts: AgentCostBreakdown[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      agentCosts.push(result.value);
    } else {
      warnings.push(result.reason?.message || "Unknown error resolving agent cost");
    }
  }

  return NextResponse.json({ agents: agentCosts, warnings });
}
