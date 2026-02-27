import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { createServiceClient } from "@/lib/supabase/server";
import { regenerateKnowledgeBase } from "@/lib/knowledge-base-generator";
import { regeneratePrompt } from "@/lib/prompt-generator";
import { encrypt, decrypt } from "@/lib/crypto";
import Retell from "retell-sdk";
import { AGENT_NAME_GENDERS } from "@/lib/conversation-flow-templates";
import { logger } from "@/lib/logger";
import { RETELL_API_BASE } from "@/lib/retell";

async function pickVoiceForGender(
  retellApiKey: string,
  gender: "male" | "female"
): Promise<string | null> {
  try {
    const retell = new Retell({ apiKey: retellApiKey });
    const voices = await retell.voice.list();
    const match =
      voices.find((v) => v.gender === gender && v.provider === "elevenlabs") ||
      voices.find((v) => v.gender === gender);
    return match?.voice_id ?? null;
  } catch (err) {
    logger.warn("Voice list fetch failed, falling back", { error: String(err) });
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  // Service-role client for privileged inserts (client portal users don't have
  // RLS INSERT permission on agents, widget_config, etc.)
  const adminDb = await createServiceClient();

  // 1. Get the onboarding record to find vertical_template_id and business info
  const { data: onboarding, error: onboardingError } = await supabase
    .from("client_onboarding")
    .select("*")
    .eq("client_id", clientId)
    .single();

  if (onboardingError || !onboarding) {
    return NextResponse.json(
      { error: "Onboarding record not found. Please start onboarding first." },
      { status: 404 }
    );
  }

  if (!onboarding.vertical_template_id) {
    return NextResponse.json(
      { error: "No template selected. Please complete step 1 first." },
      { status: 400 }
    );
  }

  // Check if an agent already exists for this client
  const { data: existingAgent } = await supabase
    .from("agents")
    .select("id, retell_agent_id, platform, retell_api_key_encrypted")
    .eq("client_id", clientId)
    .limit(1)
    .single();

  // 2. Get the agent template
  const { data: template, error: templateError } = await supabase
    .from("agent_templates")
    .select("*")
    .eq("id", onboarding.vertical_template_id)
    .single();

  if (templateError || !template) {
    return NextResponse.json({ error: "Agent template not found" }, { status: 404 });
  }

  // 3. Get org ID from users table
  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user!.id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const orgId = userData.organization_id;

  // 4. Get the Retell API key
  const { data: integration } = await supabase
    .from("integrations")
    .select("api_key_encrypted")
    .eq("organization_id", orgId)
    .eq("provider", "retell")
    .eq("is_connected", true)
    .limit(1)
    .single();

  const retellApiKey = integration?.api_key_encrypted
    ? decrypt(integration.api_key_encrypted)
    : process.env.RETELL_API_KEY;

  if (!retellApiKey) {
    return NextResponse.json(
      { error: "No API key configured. Please check your integrations settings." },
      { status: 500 }
    );
  }

  const agentType = onboarding.agent_type || "voice";

  // If agent already exists, reconfigure it with the (possibly new) template settings
  if (existingAgent) {
    try {
      // ----------------------------------------------------------------
      // Step A: ALWAYS clear old data and re-seed from the new template.
      // This must run even if the template has no retell_agent_id.
      // ----------------------------------------------------------------
      logger.info("Re-seeding template data for client", { clientId, templateId: template.id, templateName: template.name });

      await Promise.all([
        adminDb.from("business_services").delete().eq("client_id", clientId),
        adminDb.from("business_faqs").delete().eq("client_id", clientId),
        adminDb.from("business_policies").delete().eq("client_id", clientId),
        adminDb.from("business_hours").delete().eq("client_id", clientId),
        adminDb.from("business_locations").delete().eq("client_id", clientId),
        adminDb.from("conversation_flows").update({ is_active: false }).eq("client_id", clientId),
        adminDb.from("call_logs").delete().eq("agent_id", existingAgent.id),
      ]);

      // Reset onboarding counters so the dashboard starts fresh
      await adminDb.from("client_onboarding").update({
        test_calls_used: 0,
        test_call_completed: false,
        go_live_at: null,
        completed_at: null,
        first_call_notified_at: null,
        conversation_flow_deployed: false,
      }).eq("client_id", clientId);

      const reseedPromises: PromiseLike<unknown>[] = [];

      if (template.default_services && Array.isArray(template.default_services) && template.default_services.length > 0) {
        const services = template.default_services.map(
          (s: { name: string; description?: string; price_text?: string; ai_notes?: string }, i: number) => ({
            client_id: clientId,
            name: s.name,
            description: s.description || null,
            price_text: s.price_text || null,
            ai_notes: s.ai_notes || null,
            sort_order: i,
            is_active: true,
          })
        );
        reseedPromises.push(adminDb.from("business_services").insert(services));
      }

      if (template.default_faqs && Array.isArray(template.default_faqs) && template.default_faqs.length > 0) {
        const faqs = template.default_faqs.map(
          (f: { question: string; answer: string }, i: number) => ({
            client_id: clientId,
            question: f.question,
            answer: f.answer,
            sort_order: i,
            is_active: true,
          })
        );
        reseedPromises.push(adminDb.from("business_faqs").insert(faqs));
      }

      if (template.default_policies && Array.isArray(template.default_policies) && template.default_policies.length > 0) {
        const policies = template.default_policies.map(
          (p: { name: string; description: string }, i: number) => ({
            client_id: clientId,
            name: p.name,
            description: p.description,
            sort_order: i,
            is_active: true,
          })
        );
        reseedPromises.push(adminDb.from("business_policies").insert(policies));
      }

      if (template.default_hours && Array.isArray(template.default_hours) && template.default_hours.length > 0) {
        const hours = template.default_hours.map(
          (h: { day_of_week: number; is_open: boolean; open_time?: string | null; close_time?: string | null }) => ({
            client_id: clientId,
            day_of_week: h.day_of_week,
            is_open: h.is_open,
            open_time: h.is_open ? h.open_time || null : null,
            close_time: h.is_open ? h.close_time || null : null,
          })
        );
        reseedPromises.push(adminDb.from("business_hours").insert(hours));
      } else {
        const defaultHours = Array.from({ length: 7 }, (_, i) => ({
          client_id: clientId,
          day_of_week: i,
          is_open: i < 5,
          open_time: i < 5 ? "09:00:00" : null,
          close_time: i < 5 ? "17:00:00" : null,
        }));
        reseedPromises.push(adminDb.from("business_hours").insert(defaultHours));
      }

      if (onboarding.business_address) {
        reseedPromises.push(
          adminDb.from("business_locations").insert({
            client_id: clientId,
            name: onboarding.business_name || "Main Location",
            address: onboarding.business_address,
            phone: onboarding.business_phone || null,
            sort_order: 0,
            is_active: true,
          })
        );
      }

      await Promise.all(reseedPromises);
      logger.info("Re-seed complete for client", { clientId });

      // ----------------------------------------------------------------
      // Step B: Reconfigure the Retell agent (only if template has one)
      // ----------------------------------------------------------------
      if (template.retell_agent_id) {
        const selectedLanguage = (onboarding.language || "en-US") as "en-US";

        const templateRes = await fetch(
          `${RETELL_API_BASE}/v2/agents/${template.retell_agent_id}`,
          { headers: { Authorization: `Bearer ${retellApiKey}` } }
        );

        if (templateRes.ok) {
          const templateConfig = await templateRes.json();

          const isChat = existingAgent.platform === "retell-chat" || existingAgent.platform === "retell-sms";
          if (isChat) {
            const retell = new Retell({ apiKey: retellApiKey });
            await retell.chatAgent.update(existingAgent.retell_agent_id, {
              agent_name: onboarding.business_name || "AI Agent",
              language: selectedLanguage,
              response_engine: templateConfig.response_engine,
            });
          } else {
            // Override voice to match template agent's gender
            const genderKeyR = template.industry && template.use_case
              ? `${template.industry}_${template.use_case}`
              : null;
            const genderR = genderKeyR ? AGENT_NAME_GENDERS[genderKeyR] : null;
            const matchedVoiceR = genderR
              ? await pickVoiceForGender(retellApiKey, genderR)
              : null;

            // Update non-engine agent settings
            const agentSettingsPayload = {
              agent_name: onboarding.business_name || "AI Agent",
              voice_id: matchedVoiceR || templateConfig.voice_id,
              ambient_sound: templateConfig.ambient_sound,
              ambient_sound_volume: templateConfig.ambient_sound_volume,
              responsiveness: templateConfig.responsiveness,
              interruption_sensitivity: templateConfig.interruption_sensitivity,
              enable_backchannel: templateConfig.enable_backchannel,
              language: selectedLanguage,
            };

            const agentUpdateRes = await fetch(
              `${RETELL_API_BASE}/update-agent/${existingAgent.retell_agent_id}`,
              {
                method: "PATCH",
                headers: { Authorization: `Bearer ${retellApiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify(agentSettingsPayload),
              }
            );
            if (!agentUpdateRes.ok) {
              const agentUpdateText = await agentUpdateRes.text();
              logger.warn("Agent settings update warning", { response: agentUpdateText });
            }

            // Update the existing LLM — clear old states, apply template LLM content
            const getAgentRes = await fetch(
              `${RETELL_API_BASE}/get-agent/${existingAgent.retell_agent_id}`,
              { headers: { Authorization: `Bearer ${retellApiKey}` } }
            );

            if (getAgentRes.ok) {
              const agentConfig = await getAgentRes.json();
              const existingLlmId = agentConfig.response_engine?.llm_id;

              if (existingLlmId) {
                const templateLlmId = templateConfig.response_engine?.llm_id;
                let templatePrompt: string | null = null;
                let templateBeginMsg: string | null = null;
                let templateTools: unknown[] = [];

                if (templateLlmId) {
                  const templateLlmRes = await fetch(
                    `${RETELL_API_BASE}/get-retell-llm/${templateLlmId}`,
                    { headers: { Authorization: `Bearer ${retellApiKey}` } }
                  );
                  if (templateLlmRes.ok) {
                    const templateLlm = await templateLlmRes.json();
                    templatePrompt = templateLlm.general_prompt || null;
                    templateBeginMsg = templateLlm.begin_message ?? null;
                    templateTools = templateLlm.general_tools || [];
                  }
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const llmUpdate: Record<string, any> = {
                  states: [],
                  starting_state: "",
                  general_tools: templateTools.length > 0 ? templateTools : [],
                };
                if (templatePrompt) llmUpdate.general_prompt = templatePrompt;
                if (templateBeginMsg !== null) llmUpdate.begin_message = templateBeginMsg;

                const llmUpdateRes = await fetch(
                  `${RETELL_API_BASE}/update-retell-llm/${existingLlmId}`,
                  {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${retellApiKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify(llmUpdate),
                  }
                );
                if (!llmUpdateRes.ok) {
                  const llmUpdateText = await llmUpdateRes.text();
                  logger.warn("LLM update warning", { response: llmUpdateText });
                }
              }
            }
          }
        } else {
          const templateResText = await templateRes.text();
        logger.warn("Retell template fetch failed", { response: templateResText });
        }
      }

      // ----------------------------------------------------------------
      // Step C: Regenerate KB + prompt from the new business data
      // ----------------------------------------------------------------
      try {
        await regenerateKnowledgeBase(clientId!);
      } catch (kbErr) {
        console.error("KB regeneration failed during reconfigure:", kbErr);
      }
      try {
        await regeneratePrompt(clientId!);
      } catch (promptErr) {
        console.error("Prompt regeneration failed during reconfigure:", promptErr);
      }

      return NextResponse.json({
        agent_id: existingAgent.id,
        retell_agent_id: existingAgent.retell_agent_id,
      });
    } catch (err) {
      console.error("Reconfigure agent error:", err);
      return NextResponse.json(
        { error: "Failed to reconfigure agent" },
        { status: 500 }
      );
    }
  }

  try {
    const retellApiKeyEncrypted = encrypt(retellApiKey);
    let newAgentId: string;
    let agentPlatform: string;

    const selectedLanguage = (onboarding.language || "en-US") as "en-US";

    if (agentType === "chat" || agentType === "sms") {
      // ---- CHAT / SMS AGENT CREATION ----
      // SMS agents are chat agents under the hood; Retell routes SMS via the attached phone number
      const retell = new Retell({ apiKey: retellApiKey });

      // Try to get response_engine config from template's Retell agent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let responseEngine: any = undefined;
      if (template.retell_agent_id) {
        try {
          const templateRes = await fetch(
            `${RETELL_API_BASE}/v2/agents/${template.retell_agent_id}`,
            { headers: { Authorization: `Bearer ${retellApiKey}` } }
          );
          if (templateRes.ok) {
            const templateConfig = await templateRes.json();
            responseEngine = templateConfig.response_engine;
          }
        } catch {
          // Fall through to defaults
        }
      }

      if (!responseEngine) {
        // No template Retell agent — use a basic inline LLM config
        logger.info("No retell_agent_id on template — using default chat response engine");
        responseEngine = {
          type: "retell-llm",
          llm: {
            model: "gpt-4.1",
            general_prompt: "You are a helpful AI chat assistant.",
            begin_message: `Hi! Thanks for reaching out to ${onboarding.business_name || "us"}. How can I help you today?`,
          },
        };
      }

      const chatAgentConfig = {
        agent_name: onboarding.business_name || "AI Agent",
        language: selectedLanguage,
        response_engine: responseEngine,
      };

      const chatAgent = await retell.chatAgent.create(chatAgentConfig);
      newAgentId = chatAgent.agent_id;
      agentPlatform = agentType === "sms" ? "retell-sms" : "retell-chat";
    } else {
      // ---- VOICE AGENT CREATION (existing logic) ----
      let agentPayload: Record<string, unknown> = {
        agent_name: onboarding.business_name || "AI Agent",
      };

      if (template.retell_agent_id) {
        const templateRes = await fetch(
          `${RETELL_API_BASE}/v2/agents/${template.retell_agent_id}`,
          {
            headers: { Authorization: `Bearer ${retellApiKey}` },
          }
        );

        if (!templateRes.ok) {
          const errText = await templateRes.text();
          console.error("Retell template fetch error:", errText);
          return NextResponse.json(
            { error: "Failed to load template configuration. Please try again." },
            { status: 502 }
          );
        }

        const templateConfig = await templateRes.json();
        // Override voice to match template agent's gender
        const genderKeyA = template.industry && template.use_case
          ? `${template.industry}_${template.use_case}`
          : null;
        const genderA = genderKeyA ? AGENT_NAME_GENDERS[genderKeyA] : null;
        const matchedVoiceA = genderA
          ? await pickVoiceForGender(retellApiKey, genderA)
          : null;

        agentPayload = {
          ...agentPayload,
          response_engine: templateConfig.response_engine,
          voice_id: matchedVoiceA || templateConfig.voice_id,
          ambient_sound: templateConfig.ambient_sound,
          ambient_sound_volume: templateConfig.ambient_sound_volume,
          responsiveness: templateConfig.responsiveness,
          interruption_sensitivity: templateConfig.interruption_sensitivity,
          enable_backchannel: templateConfig.enable_backchannel,
          language: selectedLanguage,
        };
      } else {
        // No template Retell agent — create a fresh LLM and agent from scratch.
        // regeneratePrompt() will overwrite the prompt with the industry-specific one.
        logger.info("No retell_agent_id on template — creating fresh LLM + agent");

        const llmRes = await fetch(`${RETELL_API_BASE}/create-retell-llm`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${retellApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4.1",
            general_prompt: "You are a helpful AI phone agent.",
            begin_message: `Hi, thanks for calling ${onboarding.business_name || "us"}! How can I help you today?`,
          }),
        });

        if (!llmRes.ok) {
          const errText = await llmRes.text();
          console.error("Retell LLM creation error:", errText);
          return NextResponse.json(
            { error: "Failed to create agent configuration. Please try again." },
            { status: 502 }
          );
        }

        const newLlm = await llmRes.json();
        // Pick a voice matching the template agent's gender
        const genderKey = template.industry && template.use_case
          ? `${template.industry}_${template.use_case}`
          : null;
        const gender = genderKey ? AGENT_NAME_GENDERS[genderKey] : null;
        const matchedVoice = gender
          ? await pickVoiceForGender(retellApiKey, gender)
          : null;

        agentPayload = {
          ...agentPayload,
          response_engine: {
            type: "retell-llm",
            llm_id: newLlm.llm_id,
          },
          voice_id: matchedVoice || "11labs-Adrian",
          ambient_sound: "coffee-shop",
          ambient_sound_volume: 0.5,
          responsiveness: 1,
          interruption_sensitivity: 1,
          enable_backchannel: true,
          language: selectedLanguage,
        };
      }

      const createRes = await fetch(`${RETELL_API_BASE}/create-agent`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${retellApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(agentPayload),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error("Retell agent creation error:", errText);
        return NextResponse.json(
          { error: "Failed to create agent. Please try again." },
          { status: 502 }
        );
      }

      const newAgent = await createRes.json();
      newAgentId = newAgent.agent_id;
      agentPlatform = "retell";
    }

    // 7. Insert the new agent row (use adminDb — client portal users lack RLS INSERT on agents)
    const { data: agentRow, error: agentError } = await adminDb
      .from("agents")
      .insert({
        organization_id: orgId,
        client_id: clientId,
        name: onboarding.business_name || "AI Agent",
        retell_agent_id: newAgentId,
        retell_api_key_encrypted: retellApiKeyEncrypted,
        platform: agentPlatform,
      })
      .select("id, retell_agent_id")
      .single();

    if (agentError) {
      console.error("DB error (agents):", agentError.message);
      return NextResponse.json({ error: "Failed to save agent record" }, { status: 500 });
    }

    // 8-10. Create associated config rows in parallel
    const configPromises = [
      adminDb.from("widget_config").insert({ agent_id: agentRow.id }),
      adminDb.from("ai_analysis_config").insert({ agent_id: agentRow.id }),
      adminDb.from("campaign_config").insert({ agent_id: agentRow.id }),
    ];

    await Promise.all(configPromises);

    // 11-13. Insert default data from template
    const seedPromises: PromiseLike<unknown>[] = [];

    if (template.default_services && Array.isArray(template.default_services) && template.default_services.length > 0) {
      const services = template.default_services.map(
        (s: { name: string; description?: string; price_text?: string; ai_notes?: string }, i: number) => ({
          client_id: clientId,
          name: s.name,
          description: s.description || null,
          price_text: s.price_text || null,
          ai_notes: s.ai_notes || null,
          sort_order: i,
          is_active: true,
        })
      );
      seedPromises.push(adminDb.from("business_services").insert(services));
    }

    if (template.default_faqs && Array.isArray(template.default_faqs) && template.default_faqs.length > 0) {
      const faqs = template.default_faqs.map(
        (f: { question: string; answer: string }, i: number) => ({
          client_id: clientId,
          question: f.question,
          answer: f.answer,
          sort_order: i,
          is_active: true,
        })
      );
      seedPromises.push(adminDb.from("business_faqs").insert(faqs));
    }

    if (template.default_policies && Array.isArray(template.default_policies) && template.default_policies.length > 0) {
      const policies = template.default_policies.map(
        (p: { name: string; description: string }, i: number) => ({
          client_id: clientId,
          name: p.name,
          description: p.description,
          sort_order: i,
          is_active: true,
        })
      );
      seedPromises.push(adminDb.from("business_policies").insert(policies));
    }

    // 14. Create business hours from template or default M-F 9-5
    if (template.default_hours && Array.isArray(template.default_hours) && template.default_hours.length > 0) {
      const hours = template.default_hours.map(
        (h: { day_of_week: number; is_open: boolean; open_time?: string | null; close_time?: string | null }) => ({
          client_id: clientId,
          day_of_week: h.day_of_week,
          is_open: h.is_open,
          open_time: h.is_open ? h.open_time || null : null,
          close_time: h.is_open ? h.close_time || null : null,
        })
      );
      seedPromises.push(adminDb.from("business_hours").insert(hours));
    } else {
      const defaultHours = Array.from({ length: 7 }, (_, i) => ({
        client_id: clientId,
        day_of_week: i,
        is_open: i < 5,
        open_time: i < 5 ? "09:00:00" : null,
        close_time: i < 5 ? "17:00:00" : null,
      }));
      seedPromises.push(adminDb.from("business_hours").insert(defaultHours));
    }

    // 15. Seed primary location from onboarding business address
    if (onboarding.business_address) {
      seedPromises.push(
        adminDb.from("business_locations").insert({
          client_id: clientId,
          name: onboarding.business_name || "Main Location",
          address: onboarding.business_address,
          phone: onboarding.business_phone || null,
          sort_order: 0,
          is_active: true,
        })
      );
    }

    await Promise.all(seedPromises);

    // 16. Generate the initial prompt and push to Retell
    try {
      await regenerateKnowledgeBase(clientId!);
    } catch (promptErr) {
      // Non-fatal: the prompt can be regenerated later
      console.error("Initial KB generation failed:", promptErr);
    }

    // 17. Generate the detailed system prompt from business data and push to Retell
    try {
      await regeneratePrompt(clientId!);
    } catch (promptErr) {
      // Non-fatal: the prompt can be regenerated later from Knowledge Base page
      console.error("Initial prompt generation failed:", promptErr);
    }

    return NextResponse.json({
      agent_id: agentRow.id,
      retell_agent_id: agentRow.retell_agent_id,
    });
  } catch (err) {
    console.error("Create agent error:", err);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
