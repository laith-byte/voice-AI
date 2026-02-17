// ---------------------------------------------------------------------------
// Retell per-minute cost breakdown
// Source: https://www.retellai.com/pricing (as of 2025)
// ---------------------------------------------------------------------------

// --- Constants ---

/** Platform infrastructure cost — always applied */
export const RETELL_INFRA_COST = 0.055;

/** Telephony cost — only for phone calls */
export const TELEPHONY_COST = 0.015;

/** Voice provider per-minute costs */
export const VOICE_PROVIDER_COSTS: Record<string, number> = {
  openai: 0,
  deepgram: 0.007,
  elevenlabs: 0.015,
  cartesia: 0.015,
  minimax: 0.015,
};

/** LLM model per-minute costs */
export const LLM_MODEL_COSTS: Record<string, number> = {
  // OpenAI
  "gpt-4.1-nano": 0.004,
  "gpt-4.1-mini": 0.012,
  "gpt-4.1": 0.045,
  "gpt-4o-mini": 0.012,
  "gpt-4o": 0.045,
  "gpt-5": 0.045,
  "gpt-5-mini": 0.012,
  "gpt-4-turbo": 0.045,
  "gpt-3.5-turbo": 0.004,
  // Anthropic
  "claude-4.5-sonnet": 0.08,
  "claude-3.5-sonnet": 0.08,
  "claude-3-haiku": 0.01,
  "claude-3.5-haiku": 0.01,
  "gpt-5-nano": 0.004,
  // Anthropic
  "claude-4.5-haiku": 0.01,
  // Google
  "gemini-2.5-flash": 0.012,
  "gemini-2.5-flash-lite": 0.004,
  "gemini-2.0-flash": 0.012,
  "gemini-1.5-flash": 0.012,
  "gemini-1.5-pro": 0.045,
  // DeepSeek
  "deepseek-v3": 0.012,
  "deepseek-r1": 0.045,
  // xAI
  "grok-3-mini-fast": 0.012,
  // Open source / custom
  "llama-3.3-70b": 0.012,
  "custom-llm": 0.01,
};

/** Add-on per-minute costs */
export const ADDON_COSTS = {
  knowledgeBase: 0.005,
  advancedDenoising: 0.005,
  piiRemoval: 0.01,
} as const;

/** Monthly fixed costs */
export const MONTHLY_COSTS = {
  phoneNumberStandard: 2,
  phoneNumberTollFree: 3,
} as const;

/** Fallback when agent config is unavailable */
export const FALLBACK_COST_PER_MINUTE = 0.1;

// --- Types ---

export interface AgentCostConfig {
  agentId: string;
  agentName: string;
  llmModel: string;
  voiceProvider: string;
  isPhoneCall: boolean;
  hasKnowledgeBase: boolean;
  hasAdvancedDenoising: boolean;
  hasPiiRemoval: boolean;
}

export interface AgentCostBreakdown {
  agentId: string;
  agentName: string;
  perMinute: number;
  components: {
    infrastructure: number;
    telephony: number;
    voiceProvider: number;
    llm: number;
    knowledgeBase: number;
    advancedDenoising: number;
    piiRemoval: number;
  };
  llmModel: string;
  voiceProvider: string;
}

// --- Functions ---

/** Sum all applicable cost components for an agent configuration */
export function computeAgentCost(config: AgentCostConfig): AgentCostBreakdown {
  const infrastructure = RETELL_INFRA_COST;
  const telephony = config.isPhoneCall ? TELEPHONY_COST : 0;
  const voiceProvider = VOICE_PROVIDER_COSTS[config.voiceProvider] ?? 0;
  const llm = LLM_MODEL_COSTS[config.llmModel] ?? LLM_MODEL_COSTS["gpt-4.1"] ?? 0.045;
  const knowledgeBase = config.hasKnowledgeBase ? ADDON_COSTS.knowledgeBase : 0;
  const advancedDenoising = config.hasAdvancedDenoising ? ADDON_COSTS.advancedDenoising : 0;
  const piiRemoval = config.hasPiiRemoval ? ADDON_COSTS.piiRemoval : 0;

  const components = {
    infrastructure,
    telephony,
    voiceProvider,
    llm,
    knowledgeBase,
    advancedDenoising,
    piiRemoval,
  };

  const perMinute = Object.values(components).reduce((sum, v) => sum + v, 0);

  return {
    agentId: config.agentId,
    agentName: config.agentName,
    perMinute: Math.round(perMinute * 1000) / 1000,
    components,
    llmModel: config.llmModel,
    voiceProvider: config.voiceProvider,
  };
}

/** Human-readable labels for each cost component */
export const COST_COMPONENT_LABELS: Record<string, string> = {
  infrastructure: "Platform Infrastructure",
  telephony: "Telephony",
  voiceProvider: "Voice Synthesis",
  llm: "AI Processing (LLM)",
  knowledgeBase: "Knowledge Base",
  advancedDenoising: "Advanced Denoising",
  piiRemoval: "PII Removal",
};

/** Curated LLM models for the cost estimator UI (label + key) */
export const ESTIMATOR_LLM_MODELS = [
  { label: "GPT-4.1 Nano", key: "gpt-4.1-nano", cost: 0.004 },
  { label: "GPT-4.1 Mini", key: "gpt-4.1-mini", cost: 0.012 },
  { label: "GPT-4.1", key: "gpt-4.1", cost: 0.045 },
  { label: "Claude 3.5 Haiku", key: "claude-3.5-haiku", cost: 0.01 },
  { label: "Claude 4.5 Sonnet", key: "claude-4.5-sonnet", cost: 0.08 },
  { label: "Gemini 2.0 Flash", key: "gemini-2.0-flash", cost: 0.012 },
  { label: "Gemini 1.5 Pro", key: "gemini-1.5-pro", cost: 0.045 },
  { label: "DeepSeek V3", key: "deepseek-v3", cost: 0.012 },
  { label: "Llama 3.3 70B", key: "llama-3.3-70b", cost: 0.012 },
] as const;

/** Curated voice providers for the cost estimator UI */
export const ESTIMATOR_VOICE_PROVIDERS = [
  { label: "OpenAI", key: "openai", cost: 0 },
  { label: "Deepgram", key: "deepgram", cost: 0.007 },
  { label: "ElevenLabs", key: "elevenlabs", cost: 0.015 },
  { label: "Cartesia", key: "cartesia", cost: 0.015 },
] as const;

/** Client-facing cost categories — generic descriptions, no dollar amounts */
export const CLIENT_COST_CATEGORIES = [
  {
    label: "AI Processing",
    description:
      "Advanced language model processing that powers natural, context-aware conversations with your callers.",
  },
  {
    label: "Voice Synthesis",
    description:
      "High-quality, natural-sounding voice generation so every call sounds professional and human-like.",
  },
  {
    label: "Telephony",
    description:
      "Reliable phone connectivity including call routing, number provisioning, and carrier-grade uptime.",
  },
  {
    label: "Platform Infrastructure",
    description:
      "Secure, low-latency infrastructure that orchestrates real-time AI conversations at scale.",
  },
] as const;
