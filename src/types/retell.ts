// Retell API response types

export interface RetellAgent {
  agent_id: string;
  agent_name: string;
  voice_id: string;
  response_engine: {
    type: string;
    llm: {
      model: string;
      system_prompt: string;
      begin_message: string;
      tools: RetellTool[];
    };
  };
  ambient_sound: string | null;
  ambient_sound_volume: number;
  responsiveness: number;
  interruption_sensitivity: number;
  enable_backchanneling: boolean;
  backchannel_frequency: number;
  backchannel_words: string[];
  normalize_for_speech: boolean;
  reminder_trigger_ms: number;
  reminder_max_count: number;
  pronunciation_dictionary: { word: string; pronunciation: string }[];
  denoising: string;
  transcription_mode: string;
  vocabulary_specialization: string;
  boosted_keywords: string[];
  voicemail_detection: boolean;
  enable_keypad_input: boolean;
  end_call_after_silence_ms: number;
  max_call_duration_ms: number;
  pause_before_speaking_sec: number;
  ring_duration_sec: number;
  post_call_analysis_model: string | null;
  post_call_analysis_data: Record<string, unknown>[];
  data_storage: string;
  pii_redaction_config: Record<string, unknown> | null;
  opt_in_secure_urls: boolean;
  fallback_voice_ids: string[];
  default_dynamic_variables: Record<string, string>;
  mcp_servers: { url: string; tools: string[] }[];
}

export interface RetellTool {
  type: string;
  name: string;
  description?: string;
}

export interface RetellCall {
  call_id: string;
  agent_id: string;
  call_status: string;
  start_timestamp: number;
  end_timestamp: number;
  duration_ms: number;
  from_number: string | null;
  to_number: string | null;
  direction: "inbound" | "outbound";
  transcript: string;
  transcript_object: { role: string; content: string; words: { word: string; start: number; end: number }[] }[];
  recording_url: string | null;
  call_analysis: {
    call_summary: string;
    custom_analysis_data: Record<string, unknown>;
  } | null;
}

export interface RetellPhoneNumber {
  phone_number: string;
  phone_number_pretty: string;
  inbound_agent_id: string | null;
  outbound_agent_id: string | null;
  area_code: number;
  nickname: string | null;
}

export interface RetellWebCallResponse {
  access_token: string;
  call_id: string;
}
