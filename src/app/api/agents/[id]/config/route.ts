import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";

// Helper: fetch from Retell API
async function retellFetch(path: string, apiKey: string, options?: RequestInit) {
  return fetch(`https://api.retellai.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}

// GET: Fetch agent config from Retell API
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

  const retellApiKey = (agent.retell_api_key_encrypted ? decrypt(agent.retell_api_key_encrypted) : null)
    || await getIntegrationKey(agent.organization_id, "retell")
    || process.env.RETELL_API_KEY;
  if (!retellApiKey) {
    return NextResponse.json({ error: "No Retell API key configured" }, { status: 500 });
  }

  const isChat = agent.platform === "retell-chat";

  try {
    // Fetch agent from Retell (different endpoint for chat agents)
    const endpoint = isChat
      ? `/get-chat-agent/${agent.retell_agent_id}`
      : `/get-agent/${agent.retell_agent_id}`;
    const agentRes = await retellFetch(endpoint, retellApiKey);
    if (!agentRes.ok) {
      return NextResponse.json({ error: "Failed to fetch from Retell" }, { status: agentRes.status });
    }
    const retellAgent = await agentRes.json();

    // Determine LLM config source: inline llm object or separate llm_id
    let llmConfig: Record<string, unknown> = {};
    const engine = retellAgent.response_engine;

    if (engine?.llm_id) {
      // Fetch the separate LLM object
      const llmRes = await retellFetch(`/get-retell-llm/${engine.llm_id}`, retellApiKey);
      if (llmRes.ok) {
        llmConfig = await llmRes.json();
      }
    } else if (engine?.llm) {
      llmConfig = engine.llm;
    }

    // Map fields — handle both naming conventions
    const systemPrompt = (llmConfig.general_prompt as string) || (llmConfig.system_prompt as string) || "";
    const model = (llmConfig.model as string) || "gpt-4o";
    const firstMessage = (llmConfig.begin_message as string) || "";
    const tools = (llmConfig.general_tools as unknown[]) || (llmConfig.tools as unknown[]) || [];

    const config: Record<string, unknown> = {
      platform: agent.platform || "retell",
      system_prompt: systemPrompt,
      llm_model: model,
      first_message: firstMessage,
      functions: tools,
      llm_id: engine?.llm_id || null,
    };

    if (isChat) {
      // Chat agents have no voice/speech/transcription/call settings
      config.chat_settings = {
        max_tokens: retellAgent.max_tokens,
        temperature: retellAgent.temperature,
      };
    } else {
      // Voice agent fields
      config.voice = retellAgent.voice_id || "Hailey";
      config.speech_settings = {
        background_sound: retellAgent.ambient_sound,
        background_sound_volume: retellAgent.ambient_sound_volume,
        responsiveness: retellAgent.responsiveness,
        interruption_sensitivity: retellAgent.interruption_sensitivity,
        enable_backchanneling: retellAgent.enable_backchanneling,
        backchannel_frequency: retellAgent.backchannel_frequency,
        backchannel_words: retellAgent.backchannel_words,
        speech_normalization: retellAgent.normalize_for_speech,
        reminder_frequency_sec: retellAgent.reminder_trigger_ms
          ? retellAgent.reminder_trigger_ms / 1000
          : undefined,
        reminder_max_count: retellAgent.reminder_max_count,
        pronunciation: retellAgent.pronunciation_dictionary,
      };
      config.realtime_transcription = {
        denoising_mode: retellAgent.denoising_mode,
        transcription_mode: retellAgent.stt_mode,
        vocabulary_specialization: retellAgent.vocab_specialization,
        boosted_keywords: retellAgent.boosted_keywords,
      };
      config.call_settings = {
        voicemail_detection: retellAgent.voicemail_detection,
        keypad_input_detection: retellAgent.enable_keypad_input,
        end_call_after_silence: retellAgent.end_call_after_silence_ms,
        max_call_duration: retellAgent.max_call_duration_ms,
        pause_before_speaking: retellAgent.pause_before_speaking_sec,
        ring_duration: retellAgent.ring_duration_sec,
      };
    }

    config.post_call_analysis = {
      model: retellAgent.post_call_analysis_model,
      data: retellAgent.post_call_analysis_data,
    };
    config.security_fallback = {
      data_storage_setting: retellAgent.data_storage,
      pii_redaction: retellAgent.pii_redaction_config,
      secure_urls: retellAgent.opt_in_secure_urls,
      fallback_voice_ids: retellAgent.fallback_voice_ids,
      default_dynamic_vars: retellAgent.default_dynamic_variables,
    };
    config.mcps = retellAgent.mcp_servers || [];

    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Failed to fetch agent config" }, { status: 500 });
  }
}

// PATCH: Update agent config via Retell API
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();

  const { data: agent, error } = await supabase
    .from("agents")
    .select("retell_agent_id, retell_api_key_encrypted, platform, organization_id")
    .eq("id", id)
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

  const isChat = agent.platform === "retell-chat";

  try {
    // If the agent uses a separate LLM (llm_id), update the LLM object
    if (body.llm_id) {
      const llmUpdate: Record<string, unknown> = {};
      if (body.system_prompt !== undefined) llmUpdate.general_prompt = body.system_prompt;
      if (body.llm_model) llmUpdate.model = body.llm_model;
      if (body.first_message !== undefined) llmUpdate.begin_message = body.first_message;
      if (body.functions) llmUpdate.general_tools = body.functions;

      if (Object.keys(llmUpdate).length > 0) {
        const llmRes = await retellFetch(`/update-retell-llm/${body.llm_id}`, retellApiKey, {
          method: "PATCH",
          body: JSON.stringify(llmUpdate),
        });
        if (!llmRes.ok) {
          const err = await llmRes.text();
          console.error("Retell LLM update error:", err);
          return NextResponse.json({ error: "Failed to update agent LLM configuration" }, { status: llmRes.status });
        }
      }
    }

    // Update the agent-level fields
    const retellUpdate: Record<string, unknown> = {};

    if (body.voice) retellUpdate.voice_id = body.voice;

    // Only set response_engine for inline LLM (no llm_id)
    if (!body.llm_id && (body.system_prompt !== undefined || body.llm_model || body.first_message || body.functions)) {
      retellUpdate.response_engine = {
        type: "retell-llm",
        llm: {
          ...(body.system_prompt !== undefined && { system_prompt: body.system_prompt }),
          ...(body.llm_model && { model: body.llm_model }),
          ...(body.first_message !== undefined && { begin_message: body.first_message }),
          ...(body.functions && { tools: body.functions }),
        },
      };
    }

    // Speech settings
    if (body.speech_settings) {
      const s = body.speech_settings;
      if (s.background_sound !== undefined) retellUpdate.ambient_sound = s.background_sound;
      if (s.background_sound_volume !== undefined) retellUpdate.ambient_sound_volume = s.background_sound_volume;
      if (s.responsiveness !== undefined) retellUpdate.responsiveness = s.responsiveness;
      if (s.interruption_sensitivity !== undefined) retellUpdate.interruption_sensitivity = s.interruption_sensitivity;
      if (s.enable_backchanneling !== undefined) retellUpdate.enable_backchanneling = s.enable_backchanneling;
      if (s.backchannel_frequency !== undefined) retellUpdate.backchannel_frequency = s.backchannel_frequency;
      if (s.backchannel_words !== undefined) retellUpdate.backchannel_words = s.backchannel_words;
      if (s.speech_normalization !== undefined) retellUpdate.normalize_for_speech = s.speech_normalization;
      if (s.reminder_frequency_sec !== undefined) retellUpdate.reminder_trigger_ms = s.reminder_frequency_sec * 1000;
      if (s.reminder_max_count !== undefined) retellUpdate.reminder_max_count = s.reminder_max_count;
      if (s.pronunciation !== undefined) retellUpdate.pronunciation_dictionary = s.pronunciation;
    }

    // Realtime transcription
    if (body.realtime_transcription) {
      const r = body.realtime_transcription;
      if (r.denoising_mode !== undefined) retellUpdate.denoising_mode = r.denoising_mode;
      if (r.transcription_mode !== undefined) retellUpdate.stt_mode = r.transcription_mode;
      if (r.vocabulary_specialization !== undefined) retellUpdate.vocab_specialization = r.vocabulary_specialization;
      if (r.boosted_keywords !== undefined) retellUpdate.boosted_keywords = r.boosted_keywords;
    }

    // Call settings
    if (body.call_settings) {
      const c = body.call_settings;
      if (c.voicemail_detection !== undefined) retellUpdate.voicemail_detection = c.voicemail_detection;
      if (c.keypad_input_detection !== undefined) retellUpdate.enable_keypad_input = c.keypad_input_detection;
      if (c.end_call_after_silence !== undefined) retellUpdate.end_call_after_silence_ms = c.end_call_after_silence;
      if (c.max_call_duration !== undefined) retellUpdate.max_call_duration_ms = c.max_call_duration;
      if (c.pause_before_speaking !== undefined) retellUpdate.pause_before_speaking_sec = c.pause_before_speaking;
      if (c.ring_duration !== undefined) retellUpdate.ring_duration_sec = c.ring_duration;
    }

    // Post call analysis
    if (body.post_call_analysis) {
      if (body.post_call_analysis.model) retellUpdate.post_call_analysis_model = body.post_call_analysis.model;
      if (body.post_call_analysis.data) retellUpdate.post_call_analysis_data = body.post_call_analysis.data;
    }

    // Security fallback
    if (body.security_fallback) {
      const sf = body.security_fallback;
      if (sf.data_storage_setting !== undefined) retellUpdate.data_storage = sf.data_storage_setting;
      if (sf.pii_redaction !== undefined) retellUpdate.pii_redaction_config = sf.pii_redaction;
      if (sf.secure_urls !== undefined) retellUpdate.opt_in_secure_urls = sf.secure_urls;
      if (sf.fallback_voice_ids !== undefined) retellUpdate.fallback_voice_ids = sf.fallback_voice_ids;
      if (sf.default_dynamic_vars !== undefined) retellUpdate.default_dynamic_variables = sf.default_dynamic_vars;
    }

    // MCPs
    if (body.mcps !== undefined) retellUpdate.mcp_servers = body.mcps;

    // Only call agent update if there are agent-level fields to update
    if (Object.keys(retellUpdate).length > 0) {
      const updateEndpoint = isChat
        ? `/update-chat-agent/${agent.retell_agent_id}`
        : `/update-agent/${agent.retell_agent_id}`;
      const retellRes = await retellFetch(updateEndpoint, retellApiKey, {
        method: "PATCH",
        body: JSON.stringify(retellUpdate),
      });

      if (!retellRes.ok) {
        const err = await retellRes.text();
        console.error("Retell API error:", err);
        return NextResponse.json({ error: "Failed to update agent configuration" }, { status: retellRes.status });
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update agent config" }, { status: 500 });
  }
}
