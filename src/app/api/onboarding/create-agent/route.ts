import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { regeneratePrompt } from "@/lib/prompt-generator";
import { encrypt, decrypt } from "@/lib/crypto";
import Retell from "retell-sdk";

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

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

  // Check if an agent already exists for this client (idempotent)
  const { data: existingAgent } = await supabase
    .from("agents")
    .select("id, retell_agent_id")
    .eq("client_id", clientId)
    .limit(1)
    .single();

  if (existingAgent) {
    return NextResponse.json({
      agent_id: existingAgent.id,
      retell_agent_id: existingAgent.retell_agent_id,
    });
  }

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
      { error: "No Retell API key configured" },
      { status: 500 }
    );
  }

  const agentType = onboarding.agent_type || "voice";

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
            `https://api.retellai.com/v2/agents/${template.retell_agent_id}`,
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
        return NextResponse.json(
          { error: "No template agent configuration found. Please select a different template or contact support." },
          { status: 400 }
        );
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
          `https://api.retellai.com/v2/agents/${template.retell_agent_id}`,
          {
            headers: { Authorization: `Bearer ${retellApiKey}` },
          }
        );

        if (!templateRes.ok) {
          const errText = await templateRes.text();
          console.error("Retell template fetch error:", errText);
          return NextResponse.json(
            { error: "Failed to fetch template agent from Retell" },
            { status: 502 }
          );
        }

        const templateConfig = await templateRes.json();
        agentPayload = {
          ...agentPayload,
          response_engine: templateConfig.response_engine,
          voice_id: templateConfig.voice_id,
          ambient_sound: templateConfig.ambient_sound,
          ambient_sound_volume: templateConfig.ambient_sound_volume,
          responsiveness: templateConfig.responsiveness,
          interruption_sensitivity: templateConfig.interruption_sensitivity,
          enable_backchanneling: templateConfig.enable_backchanneling,
          language: selectedLanguage,
        };
      } else {
        return NextResponse.json(
          { error: "No template agent configuration found. Please select a different template or contact support." },
          { status: 400 }
        );
      }

      const createRes = await fetch("https://api.retellai.com/v2/agents", {
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
          { error: "Failed to create agent in Retell" },
          { status: 502 }
        );
      }

      const newAgent = await createRes.json();
      newAgentId = newAgent.agent_id;
      agentPlatform = "retell";
    }

    // 7. Insert the new agent row
    const { data: agentRow, error: agentError } = await supabase
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
      supabase.from("widget_config").insert({ agent_id: agentRow.id }),
      supabase.from("ai_analysis_config").insert({ agent_id: agentRow.id }),
      supabase.from("campaign_config").insert({ agent_id: agentRow.id }),
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
      seedPromises.push(supabase.from("business_services").insert(services));
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
      seedPromises.push(supabase.from("business_faqs").insert(faqs));
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
      seedPromises.push(supabase.from("business_policies").insert(policies));
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
      seedPromises.push(supabase.from("business_hours").insert(hours));
    } else {
      const defaultHours = Array.from({ length: 7 }, (_, i) => ({
        client_id: clientId,
        day_of_week: i,
        is_open: i < 5,
        open_time: i < 5 ? "09:00:00" : null,
        close_time: i < 5 ? "17:00:00" : null,
      }));
      seedPromises.push(supabase.from("business_hours").insert(defaultHours));
    }

    // 15. Seed primary location from onboarding business address
    if (onboarding.business_address) {
      seedPromises.push(
        supabase.from("business_locations").insert({
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
      await regeneratePrompt(clientId!);
    } catch (promptErr) {
      // Non-fatal: the prompt can be regenerated later
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
