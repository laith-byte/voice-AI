import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";
import { createServiceClient } from "@/lib/supabase/server";
import {
  DEFAULT_FLOW_TEMPLATE,
  type RetellNode,
  type RetellConversationNode,
  type RetellLLMState,
  type ConversationFlowData,
  type ConversationFlowTool,
} from "@/lib/prompt-tree-types";
import { compileFlowToRetellStates, filterStatesForRetell } from "@/lib/compile-flow-to-retell";
import type { FlowNode } from "@/lib/conversation-flow-templates";

// Helper: fetch from Retell API (same pattern as config/route.ts)
async function retellFetch(
  path: string,
  apiKey: string,
  options?: RequestInit
) {
  return fetch(`https://api.retellai.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}

// Resolve Retell API key for an agent (same pattern as config/route.ts)
async function resolveApiKey(agent: {
  retell_api_key_encrypted: string | null;
  organization_id: string;
}): Promise<string | null> {
  return (
    (agent.retell_api_key_encrypted
      ? decrypt(agent.retell_api_key_encrypted)
      : null) ||
    (await getIntegrationKey(agent.organization_id, "retell")) ||
    process.env.RETELL_API_KEY ||
    null
  );
}

// Try to extract a conversation_flow_id from the Retell agent response_engine
function extractFlowId(engine: Record<string, unknown> | undefined | null): string | null {
  if (!engine) return null;
  if (typeof engine.conversation_flow_id === "string" && engine.conversation_flow_id) {
    return engine.conversation_flow_id;
  }
  if (typeof engine["conversation-flow-id"] === "string" && engine["conversation-flow-id"]) {
    return engine["conversation-flow-id"] as string;
  }
  return null;
}

/**
 * Merge compiled per-state tools into the LLM data for the editor.
 * The compiler generates ALL tools (including custom tools that need public
 * URLs), but Retell only stores the ones it can validate. This function
 * ensures the editor sees all configured tools, even on localhost.
 */
function mergCompiledToolsIntoLlm(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llmData: Record<string, any>,
  compiled: { states: { name: string; tools?: unknown[] }[] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  if (!compiled.states.length || !llmData.states?.length) return llmData;

  // Build map of compiled tools by state name
  const compiledToolsByState: Record<string, unknown[]> = {};
  for (const s of compiled.states) {
    if (s.tools && s.tools.length > 0) {
      compiledToolsByState[s.name] = s.tools;
    }
  }

  // If no compiled state has tools, nothing to merge
  if (Object.keys(compiledToolsByState).length === 0) return llmData;

  // Merge: for each LLM state, use compiled tools if the LLM state has none
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mergedStates = (llmData.states as any[]).map((s: any) => {
    const compiledTools = compiledToolsByState[s.name];
    if (!compiledTools) return s;
    // If Retell already has tools for this state, keep them (they're validated)
    if (s.tools && s.tools.length > 0) return s;
    // Otherwise, use the compiler's tools (may include localhost custom tools)
    return { ...s, tools: compiledTools };
  });

  return { ...llmData, states: mergedStates };
}

// ─── Retell LLM ↔ ConversationFlowData Conversion ──────────────────────────

/**
 * Convert retell-llm states to our ConversationFlowData format.
 * Each LLM state becomes a "conversation" node.
 */
function convertLLMToFlow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llm: Record<string, any>
): ConversationFlowData {
  const states: RetellLLMState[] = llm.states ?? [];

  const nodes: RetellNode[] = states.map(
    (state: RetellLLMState, index: number): RetellConversationNode => ({
      id: state.name,
      type: "conversation",
      name: state.name,
      // Auto-layout: vertical arrangement
      display_position: { x: 0, y: index * 300 },
      instruction: {
        text: state.state_prompt ?? "",
        type: "prompt",
      },
      edges: (state.edges ?? []).map((edge, edgeIdx) => ({
        id: `edge_${state.name}_${edgeIdx}`,
        destination_node_id: edge.destination_state_name,
        transition_condition: {
          type: "prompt" as const,
          prompt: edge.description ?? "",
        },
      })),
    })
  );

  // Map model string to our ModelChoice format
  // retell-llm uses top-level `model` (string) and `model_high_priority` (boolean)
  const modelChoice = llm.model
    ? {
        model: llm.model,
        type: "cascading" as const,
        ...(llm.model_high_priority ? { high_priority: true } : {}),
      }
    : undefined;

  return {
    nodes,
    start_node_id:
      llm.starting_state ?? (states.length > 0 ? states[0].name : null),
    start_speaker: llm.start_speaker ?? "agent",
    global_prompt: llm.general_prompt ?? null,
    model_choice: modelChoice,
    model_temperature: llm.model_temperature ?? null,
    tools: llm.general_tools ?? [],
    knowledge_base_ids: llm.knowledge_base_ids ?? null,
    default_dynamic_variables: llm.default_dynamic_variables ?? null,
    tool_call_strict_mode: llm.tool_call_strict_mode ?? null,
  };
}

/**
 * Convert our ConversationFlowData nodes back to retell-llm state format.
 * Uses the original LLM data as a base to preserve per-state tools,
 * edge parameters, and other fields the editor doesn't expose.
 */
function convertFlowToLLM(
  body: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  originalLLM: Record<string, any> | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  const nodes = (body.nodes ?? []) as RetellNode[];

  // Retell retell-llm state names must be [a-zA-Z0-9_-], max 64 chars
  function sanitizeStateName(name: string): string {
    return name
      .replace(/&/g, "and")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 64);
  }

  // Build a map from node ID to sanitized state name (for edge destination resolution)
  const nodeIdToName: Record<string, string> = {};
  for (const node of nodes) {
    nodeIdToName[node.id] = sanitizeStateName(node.name ?? node.id);
  }

  // Set of valid state names (only conversation nodes become states in retell-llm)
  const validStateNames = new Set<string>();
  for (const node of nodes) {
    if (node.type === "conversation") {
      validStateNames.add(sanitizeStateName(node.name ?? node.id));
    }
  }

  // Build a map of original states for preserving per-state tools and edge params
  const originalStates: Record<string, RetellLLMState> = {};
  if (originalLLM?.states) {
    for (const state of originalLLM.states as RetellLLMState[]) {
      originalStates[state.name] = state;
    }
  }

  const states = nodes
    .filter((n) => n.type === "conversation")
    .map((node) => {
      const convNode = node as RetellConversationNode;
      const stateName = sanitizeStateName(convNode.name ?? convNode.id);

      // Find original state by matching on ID, sanitized name, or raw name
      const origState =
        originalStates[convNode.id] || originalStates[stateName] || originalStates[convNode.name ?? ""];

      // Build original edges map for parameter preservation
      const origEdgesByDest: Record<
        string,
        RetellLLMState["edges"] extends (infer E)[] | undefined ? E : never
      > = {};
      if (origState?.edges) {
        for (const e of origState.edges) {
          origEdgesByDest[e.destination_state_name] = e;
        }
      }

      return {
        name: stateName,
        state_prompt: convNode.instruction?.text ?? "",
        edges: (convNode.edges ?? [])
          // Filter out edges without a valid destination (required by Retell API)
          .filter((edge) => {
            const dest = edge.destination_node_id;
            return dest && dest.trim() !== "";
          })
          .map((edge) => {
            const destName =
              nodeIdToName[edge.destination_node_id ?? ""] ??
              edge.destination_node_id ??
              "";
            const origEdge = origEdgesByDest[destName];
            const description =
              edge.transition_condition?.type === "prompt"
                ? edge.transition_condition.prompt
                : "";
            return {
              destination_state_name: destName,
              // Retell requires a non-empty description; fall back to a default
              description: description || "Transition to next state",
              // Preserve parameters from original edge
              ...(origEdge?.parameters
                ? { parameters: origEdge.parameters }
                : {}),
            };
          })
          // Remove edges pointing to non-conversation nodes (they don't become states)
          .filter((edge) => validStateNames.has(edge.destination_state_name)),
        // Preserve per-state tools from original
        ...(origState?.tools ? { tools: origState.tools } : {}),
      };
    });

  // Resolve start node
  const startNodeId = body.start_node_id as string | undefined;
  const startingState = startNodeId
    ? nodeIdToName[startNodeId] ?? startNodeId
    : states.length > 0
      ? states[0].name
      : undefined;

  // Build the LLM update payload
  // Use explicit undefined checks (not ??) to allow null values through —
  // null means "clear this field" vs undefined means "not provided"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {
    states,
    starting_state: startingState,
    // NOTE: start_speaker is NOT a retell-llm field (it's conversation-flow
    // only). Sending it to the retell-llm endpoint causes a 400 error.
    // Do NOT include it in the payload.
  };

  // general_prompt: use body value if provided, otherwise preserve original
  const generalPrompt =
    body.global_prompt !== undefined
      ? body.global_prompt
      : originalLLM?.general_prompt;
  if (generalPrompt != null) {
    payload.general_prompt = generalPrompt;
  }

  // Only include general_tools if provided
  const tools = body.tools as ConversationFlowTool[] | undefined;
  if (tools !== undefined) {
    payload.general_tools = tools;
  }

  // Model — retell-llm uses top-level `model` and `model_high_priority`
  const modelChoice = body.model_choice as
    | { model: string; high_priority?: boolean }
    | undefined;
  if (modelChoice?.model) {
    payload.model = modelChoice.model;
  }
  if (modelChoice && modelChoice.high_priority !== undefined) {
    payload.model_high_priority = modelChoice.high_priority;
  }

  // Optional fields — only include if non-null (Retell rejects null values)
  if (body.model_temperature != null)
    payload.model_temperature = body.model_temperature;
  if (body.knowledge_base_ids != null)
    payload.knowledge_base_ids = body.knowledge_base_ids;
  if (body.default_dynamic_variables != null)
    payload.default_dynamic_variables = body.default_dynamic_variables;
  if (body.tool_call_strict_mode != null)
    payload.tool_call_strict_mode = body.tool_call_strict_mode;

  // Preserve begin_message from original LLM (not exposed in editor)
  if (originalLLM?.begin_message !== undefined) {
    payload.begin_message = originalLLM.begin_message;
  }

  return payload;
}

// GET: Fetch conversation flow for an agent
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;

  const { data: agent, error } = await supabase
    .from("agents")
    .select(
      "retell_agent_id, retell_api_key_encrypted, platform, organization_id, conversation_flow_id, client_id"
    )
    .eq("id", id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const retellApiKey = await resolveApiKey(agent);
  if (!retellApiKey) {
    return NextResponse.json(
      { error: "No API key configured. Please check your integrations settings." },
      { status: 500 }
    );
  }

  try {
    // Fetch agent from Retell to check response_engine type
    const isChat =
      agent.platform === "retell-chat" || agent.platform === "retell-sms";
    const endpoint = isChat
      ? `/get-chat-agent/${agent.retell_agent_id}`
      : `/get-agent/${agent.retell_agent_id}`;
    const agentRes = await retellFetch(endpoint, retellApiKey);

    if (!agentRes.ok) {
      console.error(
        `[conversation-flow] GET agent failed: ${agentRes.status}`,
        await agentRes.text().catch(() => "")
      );
      return NextResponse.json(
        { error: "Failed to fetch agent configuration" },
        { status: agentRes.status }
      );
    }

    const retellAgent = await agentRes.json();
    const engine = retellAgent.response_engine;
    console.log("[conversation-flow GET] engine type:", engine?.type, "| llm_id:", engine?.llm_id, "| has inline llm:", !!engine?.llm);

    // ── Handle retell-llm engine type (multi-prompt states) ──────────
    if (engine?.type === "retell-llm" && engine.llm_id) {
      const llmId = engine.llm_id as string;
      const llmRes = await retellFetch(
        `/get-retell-llm/${llmId}`,
        retellApiKey
      );

      if (!llmRes.ok) {
        console.error(
          `[conversation-flow] GET retell-llm failed: ${llmRes.status}`,
          await llmRes.text().catch(() => "")
        );
        return NextResponse.json(
          { error: "Failed to fetch LLM configuration" },
          { status: llmRes.status }
        );
      }

      const llmData = await llmRes.json();
      console.log("[conversation-flow GET] LLM", llmId, "| states:", (llmData.states || []).length, "| starting_state:", llmData.starting_state, "| state names:", (llmData.states || []).map((s: { name: string }) => s.name));

      // ── Self-healing: check Supabase for a deployed conversation flow ──
      // The onboarding wizard may deploy to a different agent than the one
      // the user views in the portal (multi-agent scenario). When that
      // happens the LLM for THIS agent has 0 states, or only the 3 generic
      // DEFAULT_FLOW_TEMPLATE states, while Supabase holds the real template
      // nodes.  We query by client_id (broader than agent_id) so we find the
      // flow regardless of which agent it was originally linked to.
      const llmStateCount = (llmData.states || []).length;

      try {
        const adminDb = await createServiceClient();

        // First try exact match by agent_id, then fall back to client_id
        let activeFlow: { id: string; nodes: unknown; client_id: string; agent_id: string | null } | null = null;

        const { data: byAgent } = await adminDb
          .from("conversation_flows")
          .select("id, nodes, client_id, agent_id")
          .eq("agent_id", id)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (byAgent?.nodes && Array.isArray(byAgent.nodes) && byAgent.nodes.length > 0) {
          activeFlow = byAgent;
        }

        // Fallback: search by client_id (handles the two-agent scenario)
        if (!activeFlow && agent.client_id) {
          const { data: byClient } = await adminDb
            .from("conversation_flows")
            .select("id, nodes, client_id, agent_id")
            .eq("client_id", agent.client_id)
            .eq("is_active", true)
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();

          if (byClient?.nodes && Array.isArray(byClient.nodes) && byClient.nodes.length > 0) {
            activeFlow = byClient;
          }
        }

        if (activeFlow && Array.isArray(activeFlow.nodes) && activeFlow.nodes.length > 0) {
          const flowClientId = activeFlow.client_id || agent.client_id || "";
          const compiled = compileFlowToRetellStates(
            activeFlow.nodes as FlowNode[],
            flowClientId
          );
          const compiledCount = compiled.states.length;

          // Redeploy if: LLM has 0 states, or Supabase flow has MORE states
          // (indicating a richer template was deployed to a different agent),
          // or compiled states have per-state tools that the LLM states lack.
          const compiledHasStateTools = compiled.states.some(s => s.tools && s.tools.length > 0);
          const llmHasStateTools = (llmData.states || []).some((s: { tools?: unknown[] }) => s.tools && s.tools.length > 0);
          const needsRedeploy =
            llmStateCount === 0 ||
            compiledCount > llmStateCount ||
            (compiledHasStateTools && !llmHasStateTools);

          console.log(
            "[conversation-flow GET] Supabase flow", activeFlow.id,
            "| flow agent_id:", activeFlow.agent_id,
            "| this agent:", id,
            "| Supabase nodes:", (activeFlow.nodes as unknown[]).length,
            "| compiled states:", compiledCount,
            "| compiled tools:", compiled.general_tools.length,
            "| LLM states:", llmStateCount,
            "| LLM tools:", (llmData.general_tools || []).length,
            "| needs redeploy:", needsRedeploy
          );

          if (needsRedeploy) {
            console.log(
              "[conversation-flow GET] Auto-redeploying",
              compiledCount,
              "states to LLM",
              llmId,
              "(was", llmStateCount, ")"
            );

            // Build redeploy payload: set states, preserve existing prompt/tools
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const redeployPayload: Record<string, any> = {
              states: filterStatesForRetell(compiled.states),
              starting_state: compiled.starting_state,
            };

            // Preserve existing general_prompt and begin_message
            if (llmData.general_prompt) {
              redeployPayload.general_prompt = llmData.general_prompt;
            }
            if (llmData.begin_message !== undefined) {
              redeployPayload.begin_message = llmData.begin_message;
            }

            // Tools live on individual states (state.tools) now.
            // Clear general_tools to avoid duplicate name conflicts.
            redeployPayload.general_tools = [];

            const redeployRes = await retellFetch(
              `/update-retell-llm/${llmId}`,
              retellApiKey,
              {
                method: "PATCH",
                body: JSON.stringify(redeployPayload),
              }
            );

            if (redeployRes.ok) {
              const patchLlm = await redeployRes.json();
              console.log(
                "[conversation-flow GET] Auto-redeploy PATCH succeeded:",
                (patchLlm.states || []).length,
                "states on LLM",
                llmId,
                "| PATCH response has state tools:",
                (patchLlm.states || []).map((s: { name: string; tools?: unknown[] }) => `${s.name}:${(s.tools || []).length}`)
              );

              // Verification GET: The Retell PATCH response may not include
              // per-state tools in the response body. Do a fresh GET to ensure
              // _retell_llm_data has the complete state including tools.
              let finalLlm = patchLlm;
              try {
                const verifyRes = await retellFetch(
                  `/get-retell-llm/${llmId}`,
                  retellApiKey
                );
                if (verifyRes.ok) {
                  finalLlm = await verifyRes.json();
                  console.log(
                    "[conversation-flow GET] Verification GET:",
                    (finalLlm.states || []).length,
                    "states",
                    "| state tools:",
                    (finalLlm.states || []).map((s: { name: string; tools?: unknown[] }) => `${s.name}:${(s.tools || []).length}`)
                  );
                }
              } catch (verifyErr) {
                console.warn("[conversation-flow GET] Verification GET failed:", verifyErr);
              }

              // Also update the flow's agent_id to point to this agent
              // so future loads skip the client_id fallback.
              if (activeFlow.agent_id !== id) {
                Promise.resolve(
                  adminDb
                    .from("conversation_flows")
                    .update({ agent_id: id })
                    .eq("id", activeFlow.id)
                ).then(() =>
                  console.log(
                    "[conversation-flow GET] Updated flow",
                    activeFlow!.id,
                    "agent_id to",
                    id
                  )
                ).catch(() => {});
              }

              // Merge compiled tools into the LLM data for the editor.
              // Retell may not store custom tools with localhost URLs, but
              // the editor should show all configured tools.
              const enrichedLlm = mergCompiledToolsIntoLlm(finalLlm, compiled);
              const convertedFlow = convertLLMToFlow(enrichedLlm);
              return NextResponse.json({
                exists: true,
                flow: convertedFlow,
                conversation_flow_id: null,
                engine_type: "retell-llm",
                llm_id: llmId,
                _retell_llm_data: enrichedLlm,
              });
            } else {
              console.error(
                "[conversation-flow GET] Auto-redeploy PATCH failed:",
                redeployRes.status,
                await redeployRes.text().catch(() => "")
              );
            }
          }
        } else if (llmStateCount === 0) {
          console.log(
            "[conversation-flow GET] No active Supabase flow found for agent",
            id,
            "or client",
            agent.client_id
          );
        }
      } catch (fallbackErr) {
        console.error(
          "[conversation-flow GET] Self-healing error:",
          fallbackErr
        );
      }

      // If LLM has 0 states and no Supabase flow was found/deployed
      if (llmStateCount === 0) {
        return NextResponse.json({
          exists: false,
          flow: null,
          conversation_flow_id: null,
          engine_type: "retell-llm",
          llm_id: llmId,
        });
      }

      // Merge compiled tools for the editor.
      // Re-compile from Supabase to get the full tool set (including
      // custom tools blocked by isPublicUrl on localhost).
      let enrichedLlmData = llmData;
      try {
        const adminDb2 = await createServiceClient();
        const { data: flowForTools } = await adminDb2
          .from("conversation_flows")
          .select("nodes, client_id")
          .eq("agent_id", id)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();
        if (flowForTools?.nodes && Array.isArray(flowForTools.nodes) && flowForTools.nodes.length > 0) {
          const compiledForTools = compileFlowToRetellStates(
            flowForTools.nodes as FlowNode[],
            flowForTools.client_id || agent.client_id || ""
          );
          enrichedLlmData = mergCompiledToolsIntoLlm(llmData, compiledForTools);
        }
      } catch {
        // Proceed with Retell data only
      }

      // Log per-state tools for debugging
      console.log(
        "[conversation-flow GET] LLM state tools (enriched):",
        (enrichedLlmData.states || []).map((s: { name: string; tools?: unknown[] }) => `${s.name}:${(s.tools || []).length}`)
      );

      // Convert LLM states to our ConversationFlowData format
      const convertedFlow = convertLLMToFlow(enrichedLlmData);

      return NextResponse.json({
        exists: true,
        flow: convertedFlow,
        conversation_flow_id: null,
        engine_type: "retell-llm",
        llm_id: llmId,
        _retell_llm_data: enrichedLlmData,
      });
    }

    // ── Handle conversation-flow engine type ─────────────────────────
    let flowId = extractFlowId(engine);

    // Fallback: use the flow ID stored in our database
    if (!flowId && agent.conversation_flow_id) {
      flowId = agent.conversation_flow_id;
    }

    if (flowId) {
      const flowRes = await retellFetch(
        `/get-conversation-flow/${flowId}`,
        retellApiKey
      );

      if (flowRes.ok) {
        const flow = await flowRes.json();

        // If we had to use the Supabase fallback, try to fix the Retell agent
        if (!extractFlowId(engine) && agent.conversation_flow_id) {
          const updateAgentEndpoint = isChat
            ? `/update-chat-agent/${agent.retell_agent_id}`
            : `/update-agent/${agent.retell_agent_id}`;
          retellFetch(updateAgentEndpoint, retellApiKey, {
            method: "PATCH",
            body: JSON.stringify({
              response_engine: {
                type: "conversation-flow",
                conversation_flow_id: flowId,
              },
            }),
          }).catch((err) =>
            console.error(
              "[conversation-flow] Background agent fix failed:",
              err
            )
          );
        }

        return NextResponse.json({
          exists: true,
          flow,
          conversation_flow_id: flowId,
          engine_type: "conversation-flow",
        });
      } else {
        console.error(
          `[conversation-flow] GET flow ${flowId} failed: ${flowRes.status}`,
          await flowRes.text().catch(() => "")
        );
        // Flow ID was stale — clear it from Supabase (use service client to bypass RLS)
        if (agent.conversation_flow_id) {
          const adminDb = await createServiceClient();
          await adminDb
            .from("agents")
            .update({ conversation_flow_id: null })
            .eq("id", id);
        }
      }
    }

    // Agent doesn't have a conversation flow yet
    return NextResponse.json({
      exists: false,
      flow: null,
      conversation_flow_id: null,
    });
  } catch (err) {
    console.error("Conversation flow fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch conversation flow" },
      { status: 500 }
    );
  }
}

// PUT: Create or update conversation flow for an agent
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();

  const { data: agent, error } = await supabase
    .from("agents")
    .select(
      "retell_agent_id, retell_api_key_encrypted, platform, organization_id, conversation_flow_id, client_id"
    )
    .eq("id", id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const retellApiKey = await resolveApiKey(agent);
  if (!retellApiKey) {
    return NextResponse.json(
      { error: "No API key configured. Please check your integrations settings." },
      { status: 500 }
    );
  }

  try {
    const isChat =
      agent.platform === "retell-chat" || agent.platform === "retell-sms";

    // ── Handle retell-llm engine type save ───────────────────────────
    if (body.engine_type === "retell-llm" && body.llm_id) {
      const llmId = body.llm_id as string;
      const originalLLM = (body._retell_llm_data as Record<string, unknown>) ?? null;
      const llmPayload = convertFlowToLLM(body, originalLLM);
      // Filter out custom tools with non-public URLs before sending to Retell
      if (llmPayload.states) {
        llmPayload.states = filterStatesForRetell(llmPayload.states);
      }

      console.log(
        "[conversation-flow PUT] Saving retell-llm",
        llmId,
        "| states:",
        (llmPayload.states || []).length,
        "| state tools:",
        (llmPayload.states || []).map((s: { name: string; tools?: unknown[] }) => `${s.name}:${(s.tools || []).length}`),
        "| general_tools:",
        (llmPayload.general_tools || []).length,
        "| payload keys:",
        Object.keys(llmPayload)
      );

      const updateRes = await retellFetch(
        `/update-retell-llm/${llmId}`,
        retellApiKey,
        {
          method: "PATCH",
          body: JSON.stringify(llmPayload),
        }
      );

      if (!updateRes.ok) {
        const err = await updateRes.text();
        console.error("[conversation-flow PUT] Retell LLM update error:", updateRes.status, err);
        return NextResponse.json(
          { error: "Failed to update LLM config" },
          { status: updateRes.status }
        );
      }

      // Verification GET: Retell PATCH response may omit per-state tools.
      // Do a fresh GET to get the definitive state with all tools.
      let finalLLM = await updateRes.json();
      try {
        const verifyRes = await retellFetch(
          `/get-retell-llm/${llmId}`,
          retellApiKey
        );
        if (verifyRes.ok) {
          finalLLM = await verifyRes.json();
          console.log(
            "[conversation-flow PUT] Verification GET:",
            (finalLLM.states || []).length,
            "states",
            "| state tools:",
            (finalLLM.states || []).map((s: { name: string; tools?: unknown[] }) => `${s.name}:${(s.tools || []).length}`)
          );
        }
      } catch (verifyErr) {
        console.warn("[conversation-flow PUT] Verification GET failed:", verifyErr);
      }

      // Merge compiled tools back into the response for the editor.
      // Retell only stores native tools; custom tools (CRM, Calendar, etc.)
      // are stripped before PATCH. Re-enrich from the original request data
      // (which had the full tool set from the initial GET).
      let enrichedFinalLLM = finalLLM;
      if (originalLLM?.states) {
        // The originalLLM (from body._retell_llm_data) already has the
        // enriched tools from the GET handler. Use it to fill in any
        // tools that Retell didn't store.
        enrichedFinalLLM = mergCompiledToolsIntoLlm(finalLLM, {
          states: (originalLLM.states as { name: string; tools?: unknown[] }[]),
        });
      }

      const convertedFlow = convertLLMToFlow(enrichedFinalLLM);

      return NextResponse.json({
        exists: true,
        flow: convertedFlow,
        conversation_flow_id: null,
        engine_type: "retell-llm",
        llm_id: llmId,
        _retell_llm_data: enrichedFinalLLM,
      });
    }

    // ── Handle conversation-flow engine type save ────────────────────

    // Build the flow payload
    const flowPayload: Record<string, unknown> = {
      nodes: body.nodes ?? DEFAULT_FLOW_TEMPLATE.nodes,
      start_node_id:
        body.start_node_id ?? DEFAULT_FLOW_TEMPLATE.start_node_id,
      start_speaker:
        body.start_speaker ?? DEFAULT_FLOW_TEMPLATE.start_speaker,
    };

    if (body.global_prompt !== undefined)
      flowPayload.global_prompt = body.global_prompt;
    if (body.model_choice !== undefined)
      flowPayload.model_choice = body.model_choice;
    if (body.model_temperature !== undefined)
      flowPayload.model_temperature = body.model_temperature;
    if (body.begin_tag_display_position !== undefined)
      flowPayload.begin_tag_display_position = body.begin_tag_display_position;
    if (body.begin_after_user_silence_ms !== undefined)
      flowPayload.begin_after_user_silence_ms =
        body.begin_after_user_silence_ms;
    if (body.tools !== undefined) flowPayload.tools = body.tools;
    if (body.knowledge_base_ids !== undefined)
      flowPayload.knowledge_base_ids = body.knowledge_base_ids;
    if (body.default_dynamic_variables !== undefined)
      flowPayload.default_dynamic_variables = body.default_dynamic_variables;
    if (body.tool_call_strict_mode !== undefined)
      flowPayload.tool_call_strict_mode = body.tool_call_strict_mode;

    // Check if agent already has a conversation flow
    const agentEndpoint = isChat
      ? `/get-chat-agent/${agent.retell_agent_id}`
      : `/get-agent/${agent.retell_agent_id}`;
    const agentRes = await retellFetch(agentEndpoint, retellApiKey);

    if (!agentRes.ok) {
      console.error(
        `[conversation-flow] PUT get-agent failed: ${agentRes.status}`,
        await agentRes.text().catch(() => "")
      );
      return NextResponse.json(
        { error: "Failed to fetch agent configuration" },
        { status: agentRes.status }
      );
    }

    const retellAgent = await agentRes.json();
    const engine = retellAgent.response_engine;

    let existingFlowId =
      extractFlowId(engine) || agent.conversation_flow_id;

    // If we have a flow ID, try to update the existing flow
    if (existingFlowId) {
      const updateRes = await retellFetch(
        `/update-conversation-flow/${existingFlowId}`,
        retellApiKey,
        {
          method: "PATCH",
          body: JSON.stringify(flowPayload),
        }
      );

      if (updateRes.ok) {
        const updatedFlow = await updateRes.json();

        // Ensure the Retell agent is linked to this flow
        if (!extractFlowId(engine)) {
          const updateAgentEndpoint = isChat
            ? `/update-chat-agent/${agent.retell_agent_id}`
            : `/update-agent/${agent.retell_agent_id}`;
          const agentPatchRes = await retellFetch(
            updateAgentEndpoint,
            retellApiKey,
            {
              method: "PATCH",
              body: JSON.stringify({
                response_engine: {
                  type: "conversation-flow",
                  conversation_flow_id: existingFlowId,
                },
              }),
            }
          );
          if (!agentPatchRes.ok) {
            console.error(
              `[conversation-flow] Failed to re-link agent to flow:`,
              await agentPatchRes.text().catch(() => "")
            );
          }
        }

        return NextResponse.json({
          exists: true,
          flow: updatedFlow,
          conversation_flow_id: existingFlowId,
          engine_type: "conversation-flow",
        });
      }

      // If update failed with 404, the flow was deleted — fall through to create
      if (updateRes.status !== 404) {
        const err = await updateRes.text();
        console.error("Retell flow update error:", err);
        return NextResponse.json(
          { error: "Failed to update conversation flow" },
          { status: updateRes.status }
        );
      }

      // Flow no longer exists on Retell — clear the stale ID
      // Flow no longer exists on Retell — clear the stale ID and create a new one
      existingFlowId = null;
    }

    // Create new conversation flow
    const createRes = await retellFetch(
      "/create-conversation-flow",
      retellApiKey,
      {
        method: "POST",
        body: JSON.stringify(flowPayload),
      }
    );

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error("Retell flow create error:", err);
      return NextResponse.json(
        { error: "Failed to create conversation flow" },
        { status: createRes.status }
      );
    }

    const newFlow = await createRes.json();
    const newFlowId = newFlow.conversation_flow_id;

    // Save flow ID to Supabase immediately (use service client to bypass RLS)
    const adminDb = await createServiceClient();
    await adminDb
      .from("agents")
      .update({ conversation_flow_id: newFlowId })
      .eq("id", id);

    // Update agent to use the new conversation flow
    const updateAgentEndpoint = isChat
      ? `/update-chat-agent/${agent.retell_agent_id}`
      : `/update-agent/${agent.retell_agent_id}`;

    const agentUpdateRes = await retellFetch(
      updateAgentEndpoint,
      retellApiKey,
      {
        method: "PATCH",
        body: JSON.stringify({
          response_engine: {
            type: "conversation-flow",
            conversation_flow_id: newFlowId,
          },
        }),
      }
    );

    if (!agentUpdateRes.ok) {
      const err = await agentUpdateRes.text();
      console.error("Retell agent update error:", err);
      return NextResponse.json({
        exists: true,
        flow: newFlow,
        conversation_flow_id: newFlowId,
        engine_type: "conversation-flow",
        warning:
          "Flow created but agent link pending. Will retry on next load.",
      });
    }

    return NextResponse.json({
      exists: true,
      flow: newFlow,
      conversation_flow_id: newFlowId,
      engine_type: "conversation-flow",
    });
  } catch (err) {
    console.error("Conversation flow save error:", err);
    return NextResponse.json(
      { error: "Failed to save conversation flow" },
      { status: 500 }
    );
  }
}
