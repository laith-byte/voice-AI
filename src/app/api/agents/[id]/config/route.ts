import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Language directive helpers
// When the agent language is non-English we prepend a directive to the system
// prompt so the LLM actually responds in the target language.  The directive
// is stripped when returning config to the UI so the user never sees it.
// ---------------------------------------------------------------------------

const LANGUAGE_NAMES: Record<string, string> = {
  "es-ES": "Spanish", "es-419": "Latin American Spanish",
  "fr-FR": "French", "fr-CA": "Canadian French",
  "de-DE": "German", "it-IT": "Italian",
  "pt-BR": "Brazilian Portuguese", "pt-PT": "Portuguese",
  "nl-NL": "Dutch", "nl-BE": "Dutch",
  "zh-CN": "Mandarin Chinese", "ja-JP": "Japanese", "ko-KR": "Korean",
  "hi-IN": "Hindi", "ar-SA": "Arabic", "ru-RU": "Russian",
  "pl-PL": "Polish", "tr-TR": "Turkish", "vi-VN": "Vietnamese",
  "th-TH": "Thai", "sv-SE": "Swedish", "da-DK": "Danish",
  "no-NO": "Norwegian", "fi-FI": "Finnish", "uk-UA": "Ukrainian",
  "el-GR": "Greek", "cs-CZ": "Czech", "ro-RO": "Romanian",
  "hu-HU": "Hungarian", "bg-BG": "Bulgarian", "id-ID": "Indonesian",
  "sk-SK": "Slovak", "ms-MY": "Malay", "af-ZA": "Afrikaans",
  "az-AZ": "Azerbaijani", "bs-BA": "Bosnian", "cy-GB": "Welsh",
  "fa-IR": "Persian", "fil-PH": "Filipino", "gl-ES": "Galician",
  "he-IL": "Hebrew", "hr-HR": "Croatian", "hy-AM": "Armenian",
  "is-IS": "Icelandic", "kk-KZ": "Kazakh", "kn-IN": "Kannada",
  "mk-MK": "Macedonian", "mr-IN": "Marathi", "ne-NP": "Nepali",
  "sl-SI": "Slovenian", "sr-RS": "Serbian", "sw-KE": "Swahili",
  "ta-IN": "Tamil", "ur-IN": "Urdu", "yue-CN": "Cantonese",
};

const LANG_DIRECTIVE_RE = /\[LANGUAGE DIRECTIVE\][\s\S]*?\[\/LANGUAGE DIRECTIVE\]\n*/;

function stripLanguageDirective(prompt: string): string {
  return prompt.replace(LANG_DIRECTIVE_RE, "").trimStart();
}

function injectLanguageDirective(prompt: string, langCode: string): string {
  const clean = stripLanguageDirective(prompt);
  if (langCode.startsWith("en-") || langCode === "multi") return clean;
  const langName = LANGUAGE_NAMES[langCode];
  if (!langName) return clean;
  const directive =
    `[LANGUAGE DIRECTIVE] You MUST respond entirely in ${langName}. ` +
    `All of your messages — greetings, questions, confirmations, and ` +
    `everything else — must be in ${langName}. [/LANGUAGE DIRECTIVE]\n\n`;
  return directive + clean;
}

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

  const isChat = agent.platform === "retell-chat" || agent.platform === "retell-sms";

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
    // Strip any language directive so the UI sees a clean prompt
    const systemPrompt = stripLanguageDirective(
      (llmConfig.general_prompt as string) || (llmConfig.system_prompt as string) || ""
    );
    const model = (llmConfig.model as string) || "gpt-4.1";
    const firstMessage = (llmConfig.begin_message as string) || "";
    const tools = (llmConfig.general_tools as unknown[]) || (llmConfig.tools as unknown[]) || [];

    const config: Record<string, unknown> = {
      platform: agent.platform || "retell",
      system_prompt: systemPrompt,
      llm_model: model,
      first_message: firstMessage,
      functions: tools,
      llm_id: engine?.llm_id || null,
      model_high_priority: (llmConfig.model_high_priority as boolean) ?? false,
      tool_call_strict_mode: (llmConfig.tool_call_strict_mode as boolean) ?? false,
      knowledge_base_ids: (llmConfig.knowledge_base_ids as string[]) || [],
      kb_config: {
        top_k: ((llmConfig.kb_config as Record<string, unknown>)?.top_k as number) ?? 5,
        filter_score: ((llmConfig.kb_config as Record<string, unknown>)?.filter_score as number) ?? 0.7,
      },
    };

    if (isChat) {
      // Chat agents have no voice/speech/transcription/call settings
      config.chat_settings = {
        max_tokens: retellAgent.max_tokens,
        temperature: retellAgent.temperature,
        auto_close_message: retellAgent.auto_close_message ?? null,
        end_chat_after_silence_ms: retellAgent.end_chat_after_silence_ms ?? 3600000,
      };
    } else {
      // Voice agent fields
      config.voice = retellAgent.voice_id || "Hailey";
      config.voice_model = retellAgent.voice_model ?? null;
      config.voice_speed = retellAgent.voice_speed ?? 1;
      config.voice_temperature = retellAgent.voice_temperature ?? 1;
      config.volume = retellAgent.volume ?? 1;
      config.speech_settings = {
        background_sound: retellAgent.ambient_sound || "off",
        background_sound_volume: retellAgent.ambient_sound_volume,
        responsiveness: retellAgent.responsiveness,
        interruption_sensitivity: retellAgent.interruption_sensitivity,
        enable_backchanneling: retellAgent.enable_backchannel,
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
        voicemail_detection: retellAgent.enable_voicemail_detection,
        voicemail_option: retellAgent.voicemail_option ?? null,
        keypad_input_detection: retellAgent.allow_user_dtmf,
        dtmf_options: retellAgent.user_dtmf_options ?? null,
        end_call_after_silence: retellAgent.end_call_after_silence_ms,
        max_call_duration: retellAgent.max_call_duration_ms,
        begin_message_delay: retellAgent.begin_message_delay_ms,
        ring_duration: retellAgent.ring_duration_ms,
      };
    }

    config.post_call_analysis = {
      model: retellAgent.post_call_analysis_model,
      data: retellAgent.post_call_analysis_data,
    };
    config.security_fallback = {
      data_storage_setting: retellAgent.data_storage_setting,
      pii_redaction: !!retellAgent.pii_config,
      pii_categories: retellAgent.pii_config?.categories ?? [],
      secure_urls: retellAgent.opt_in_signed_url,
      signed_url_expiration_hours: retellAgent.signed_url_expiration_ms
        ? retellAgent.signed_url_expiration_ms / 3600000
        : 24,
      fallback_voice_ids: retellAgent.fallback_voice_ids,
      default_dynamic_vars: retellAgent.default_dynamic_variables,
    };
    config.mcps = retellAgent.mcp_servers || [];
    config.webhook = {
      url: retellAgent.webhook_url ?? null,
      timeout_ms: retellAgent.webhook_timeout_ms ?? 10000,
    };
    config.language = retellAgent.language || "en-US";

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

  const isChat = agent.platform === "retell-chat" || agent.platform === "retell-sms";

  try {
    // -----------------------------------------------------------------------
    // Resolve the effective prompt with the correct language directive.
    // We need BOTH the system prompt and the language to decide whether to
    // inject the directive.  When only one is present in the request we fetch
    // the other from the current Retell config so the directive is always
    // applied / stripped correctly.
    // -----------------------------------------------------------------------
    let effectivePrompt: string | undefined = body.system_prompt;
    let resolvedLanguage: string | undefined = body.language;

    const needsLanguageLookup = effectivePrompt !== undefined && resolvedLanguage === undefined;
    const needsPromptLookup = effectivePrompt === undefined && resolvedLanguage !== undefined;

    if (needsLanguageLookup || needsPromptLookup) {
      try {
        const getEndpoint = isChat
          ? `/get-chat-agent/${agent.retell_agent_id}`
          : `/get-agent/${agent.retell_agent_id}`;
        const currentRes = await retellFetch(getEndpoint, retellApiKey);
        if (currentRes.ok) {
          const currentAgent = await currentRes.json();

          if (needsLanguageLookup) {
            // system_prompt provided but no language — look up current language
            resolvedLanguage = currentAgent.language || "en-US";
          }

          if (needsPromptLookup) {
            // language provided but no system_prompt — look up current prompt
            const engine = currentAgent.response_engine;
            let currentPrompt = "";
            const lid = body.llm_id || engine?.llm_id;
            if (lid) {
              const llmRes = await retellFetch(`/get-retell-llm/${lid}`, retellApiKey);
              if (llmRes.ok) {
                const llm = await llmRes.json();
                currentPrompt = llm.general_prompt || llm.system_prompt || "";
              }
            } else if (engine?.llm) {
              currentPrompt = engine.llm.general_prompt || engine.llm.system_prompt || "";
            }
            effectivePrompt = stripLanguageDirective(currentPrompt);
          }
        }
      } catch {
        // If the lookup fails, proceed with what we have — the language
        // metadata will still update even if the directive can't be injected.
      }
    }

    // Now inject (or strip) the language directive
    if (effectivePrompt !== undefined && resolvedLanguage !== undefined) {
      effectivePrompt = injectLanguageDirective(effectivePrompt, resolvedLanguage);
    }

    // If the agent uses a separate LLM (llm_id), update the LLM object
    if (body.llm_id) {
      const llmUpdate: Record<string, unknown> = {};
      if (effectivePrompt !== undefined) llmUpdate.general_prompt = effectivePrompt;
      if (body.llm_model) llmUpdate.model = body.llm_model;
      if (body.first_message !== undefined) llmUpdate.begin_message = body.first_message;
      if (body.functions) llmUpdate.general_tools = body.functions;
      if (body.model_high_priority !== undefined) llmUpdate.model_high_priority = body.model_high_priority;
      if (body.tool_call_strict_mode !== undefined) llmUpdate.tool_call_strict_mode = body.tool_call_strict_mode;
      if (body.kb_config !== undefined) llmUpdate.kb_config = body.kb_config;
      if (body.knowledge_base_ids !== undefined) llmUpdate.knowledge_base_ids = body.knowledge_base_ids;

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

    if (body.voice && !isChat) retellUpdate.voice_id = body.voice;
    if (body.language !== undefined) retellUpdate.language = body.language;

    // Voice model controls (voice agents only)
    if (!isChat) {
      if (body.voice_model !== undefined) retellUpdate.voice_model = body.voice_model;
      if (body.voice_speed !== undefined) retellUpdate.voice_speed = body.voice_speed;
      if (body.voice_temperature !== undefined) retellUpdate.voice_temperature = body.voice_temperature;
      if (body.volume !== undefined) retellUpdate.volume = body.volume;
    }

    // Only set response_engine for inline LLM (no llm_id)
    if (!body.llm_id && (effectivePrompt !== undefined || body.llm_model || body.first_message || body.functions || body.model_high_priority !== undefined || body.tool_call_strict_mode !== undefined || body.kb_config !== undefined || body.knowledge_base_ids !== undefined)) {
      // Voice agents use general_prompt / general_tools; chat agents use
      // system_prompt / tools (matching Retell's API conventions).
      const promptField = isChat ? "system_prompt" : "general_prompt";
      const toolsField = isChat ? "tools" : "general_tools";

      retellUpdate.response_engine = {
        type: "retell-llm",
        llm: {
          ...(effectivePrompt !== undefined && { [promptField]: effectivePrompt }),
          ...(body.llm_model && { model: body.llm_model }),
          ...(body.first_message !== undefined && { begin_message: body.first_message }),
          ...(body.functions && { [toolsField]: body.functions }),
          ...(body.model_high_priority !== undefined && { model_high_priority: body.model_high_priority }),
          ...(body.tool_call_strict_mode !== undefined && { tool_call_strict_mode: body.tool_call_strict_mode }),
          ...(body.kb_config !== undefined && { kb_config: body.kb_config }),
          ...(body.knowledge_base_ids !== undefined && { knowledge_base_ids: body.knowledge_base_ids }),
        },
      };
    }

    // Speech settings (voice agents only)
    if (body.speech_settings && !isChat) {
      const s = body.speech_settings;
      if (s.background_sound !== undefined) retellUpdate.ambient_sound = s.background_sound === "off" ? null : s.background_sound;
      if (s.background_sound_volume !== undefined) retellUpdate.ambient_sound_volume = s.background_sound_volume;
      if (s.responsiveness !== undefined) retellUpdate.responsiveness = s.responsiveness;
      if (s.interruption_sensitivity !== undefined) retellUpdate.interruption_sensitivity = s.interruption_sensitivity;
      if (s.enable_backchanneling !== undefined) retellUpdate.enable_backchannel = s.enable_backchanneling;
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

    // Call settings (voice agents only)
    if (body.call_settings && !isChat) {
      const c = body.call_settings;
      if (c.voicemail_detection !== undefined) retellUpdate.enable_voicemail_detection = c.voicemail_detection;
      if (c.voicemail_option !== undefined) retellUpdate.voicemail_option = c.voicemail_option;
      if (c.keypad_input_detection !== undefined) retellUpdate.allow_user_dtmf = c.keypad_input_detection;
      if (c.dtmf_options !== undefined) retellUpdate.user_dtmf_options = c.dtmf_options;
      if (c.end_call_after_silence !== undefined) retellUpdate.end_call_after_silence_ms = c.end_call_after_silence;
      if (c.max_call_duration !== undefined) retellUpdate.max_call_duration_ms = c.max_call_duration;
      if (c.begin_message_delay !== undefined) retellUpdate.begin_message_delay_ms = c.begin_message_delay;
      if (c.ring_duration !== undefined) retellUpdate.ring_duration_ms = c.ring_duration;
    }

    // Chat settings (chat/SMS agents only)
    if (body.chat_settings && isChat) {
      const cs = body.chat_settings;
      if (cs.auto_close_message !== undefined) retellUpdate.auto_close_message = cs.auto_close_message;
      if (cs.end_chat_after_silence_ms !== undefined) retellUpdate.end_chat_after_silence_ms = cs.end_chat_after_silence_ms;
    }

    // Post call analysis
    if (body.post_call_analysis) {
      if (body.post_call_analysis.model) retellUpdate.post_call_analysis_model = body.post_call_analysis.model;
      if (body.post_call_analysis.data) retellUpdate.post_call_analysis_data = body.post_call_analysis.data;
    }

    // Security fallback
    if (body.security_fallback) {
      const sf = body.security_fallback;
      if (sf.data_storage_setting !== undefined) retellUpdate.data_storage_setting = sf.data_storage_setting;
      if (sf.pii_redaction !== undefined) {
        if (sf.pii_redaction === false) {
          retellUpdate.pii_config = null;
        } else if (sf.pii_redaction === true) {
          // When enabled, include categories if provided
          const categories = Array.isArray(sf.pii_categories) && sf.pii_categories.length > 0
            ? sf.pii_categories
            : undefined;
          retellUpdate.pii_config = { mode: "post_call", ...(categories && { categories }) };
        }
      }
      if (sf.secure_urls !== undefined) retellUpdate.opt_in_signed_url = sf.secure_urls;
      if (sf.signed_url_expiration_hours !== undefined) {
        retellUpdate.signed_url_expiration_ms = sf.signed_url_expiration_hours * 3600000;
      }
      if (sf.fallback_voice_ids !== undefined) retellUpdate.fallback_voice_ids = sf.fallback_voice_ids;
      if (sf.default_dynamic_vars !== undefined) retellUpdate.default_dynamic_variables = sf.default_dynamic_vars;
    }

    // MCPs
    if (body.mcps !== undefined) retellUpdate.mcp_servers = body.mcps;

    // Webhook
    if (body.webhook) {
      if (body.webhook.url !== undefined) retellUpdate.webhook_url = body.webhook.url;
      if (body.webhook.timeout_ms !== undefined) retellUpdate.webhook_timeout_ms = body.webhook.timeout_ms;
    }

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
