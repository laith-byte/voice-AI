"use client";

import { useState, useCallback } from "react";

interface AgentConfig {
  system_prompt: string;
  llm_model: string;
  voice: string;
  first_message: string;
  functions: Record<string, unknown>[];
  speech_settings: {
    background_sound?: string;
    background_sound_volume?: number;
    responsiveness?: number;
    interruption_sensitivity?: number;
    enable_backchanneling?: boolean;
    backchannel_frequency?: number;
    backchannel_words?: string[];
    speech_normalization?: boolean;
    reminder_frequency_sec?: number;
    reminder_max_count?: number;
    pronunciation?: Record<string, string>[];
  };
  realtime_transcription: {
    denoising_mode?: string;
    transcription_mode?: string;
    vocabulary_specialization?: string;
    boosted_keywords?: string[];
  };
  call_settings: {
    voicemail_detection?: boolean;
    keypad_input_detection?: boolean;
    end_call_after_silence?: number;
    max_call_duration?: number;
    pause_before_speaking?: number;
    ring_duration?: number;
  };
  post_call_analysis: {
    model?: string;
    data?: Record<string, unknown>[];
  };
  security_fallback: {
    data_storage_setting?: string;
    pii_redaction?: Record<string, unknown>;
    secure_urls?: boolean;
    fallback_voice_ids?: string[];
    default_dynamic_vars?: Record<string, string>;
  };
  mcps: { url: string; tools: string[] }[];
}

const defaultConfig: AgentConfig = {
  system_prompt: "",
  llm_model: "gpt-4o",
  voice: "Hailey",
  first_message: "",
  functions: [],
  speech_settings: {
    responsiveness: 0.8,
    interruption_sensitivity: 0.9,
    enable_backchanneling: false,
    backchannel_frequency: 0.5,
    backchannel_words: ["yeah", "uh-huh"],
  },
  realtime_transcription: {
    denoising_mode: "remove_noise",
    transcription_mode: "speed",
    vocabulary_specialization: "general",
    boosted_keywords: [],
  },
  call_settings: {
    voicemail_detection: false,
    keypad_input_detection: false,
    end_call_after_silence: 600000,
    max_call_duration: 3600000,
    pause_before_speaking: 0,
    ring_duration: 30,
  },
  post_call_analysis: {},
  security_fallback: {
    data_storage_setting: "everything",
    secure_urls: false,
    fallback_voice_ids: [],
    default_dynamic_vars: {},
  },
  mcps: [],
};

export function useAgentConfig(agentId: string) {
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/config`);
      if (res.ok) {
        const data = await res.json();
        setConfig({ ...defaultConfig, ...data });
      }
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  const saveConfig = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/agents/${agentId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    } finally {
      setSaving(false);
    }
  }, [agentId, config]);

  const updateConfig = useCallback((updates: Partial<AgentConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  return { config, loading, saving, fetchConfig, saveConfig, updateConfig };
}
