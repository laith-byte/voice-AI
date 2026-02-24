"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FeatureGate } from "@/components/portal/feature-gate";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Copy,
  Pencil,
  ChevronDown,
  Play,
  Save,
  Loader2,
  Plus,
  Trash2,
  Bot,
  Zap,
  AudioLines,
  Languages,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  BrainCircuit,
  Sparkles,
  Check,
  RotateCcw,
  MessageSquareText,
  Clock,
  Info,
  Send,
  DollarSign,
  Undo2,
  GitBranch,
  ArrowRight,
  Settings2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AgentTestPanel } from "@/components/agents/agent-test-panel";
import { useRetellCall } from "@/hooks/use-retell-call";

import { useDashboardTheme } from "@/components/portal/dashboard-theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { UpgradeBanner } from "@/components/portal/upgrade-banner";
import {
  LLM_MODEL_COSTS,
  VOICE_PROVIDER_COSTS,
  RETELL_INFRA_COST,
  TELEPHONY_COST,
  ADDON_COSTS,
} from "@/lib/retell-costs";
import { PiiRedactionSettings } from "@/components/knowledge-base/pii-redaction-settings";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  platform: string | null;
  retell_agent_id: string | null;
}

interface FunctionTool {
  id: string;
  name: string;
  description: string;
  type?: string;
  // agent_swap
  agent_id?: string;
  post_call_analysis_setting?: string;
  agent_version?: number;
  webhook_setting?: string;
  execution_message_description?: string;
  speak_during_execution?: boolean;
  // send_sms
  sms_content?: { type?: string; content?: string; prompt?: string };
  // mcp
  mcp_id?: string;
  speak_after_execution?: boolean;
  response_variables?: Record<string, string>;
  // extract_dynamic_variable
  variables?: Array<{ name: string; description: string; type: string; choices?: string[]; examples?: string[] }>;
  // transfer_call
  transfer_destination?: { type?: string; number?: string; extension?: string; prompt?: string };
  transfer_option?: { type?: string; show_transferee_as_caller?: boolean; on_hold_music?: string; opt_out_human_detection?: boolean; opt_out_initial_message?: boolean; agent_detection_timeout_ms?: number };
  ignore_e164_validation?: boolean;
  custom_sip_headers?: Record<string, string>;
  // custom tool
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  parameters?: { properties: Record<string, unknown>; type: string; required?: string[] };
  query_params?: Record<string, string>;
  timeout_ms?: number;
  [key: string]: unknown;
}

const TOOL_TYPE_LABELS: Record<string, string> = {
  end_call: "End Call",
  transfer_call: "Transfer Call",
  custom: "Custom Function",
  agent_swap: "Agent Swap",
  send_sms: "Send SMS",
  mcp: "MCP Tool",
  extract_dynamic_variable: "Extract Variable",
  check_availability_cal: "Check Availability",
  book_appointment_cal: "Book Appointment",
  press_digit: "Press Digit",
};

interface PostCallItem {
  name: string;
  description: string;
  type: "string" | "enum" | "boolean" | "number";
  choices?: string[];
  examples?: string[];
}

const GUARDRAIL_OUTPUT_TOPICS = [
  { value: "harassment", label: "Harassment" },
  { value: "self_harm", label: "Self Harm" },
  { value: "sexual_exploitation", label: "Sexual Exploitation" },
  { value: "violence", label: "Violence" },
  { value: "defense_and_national_security", label: "Defense & National Security" },
  { value: "illicit_and_harmful_activity", label: "Illicit & Harmful Activity" },
  { value: "gambling", label: "Gambling" },
  { value: "regulated_professional_advice", label: "Regulated Professional Advice" },
  { value: "child_safety_and_exploitation", label: "Child Safety & Exploitation" },
];

const GUARDRAIL_INPUT_TOPICS = [
  { value: "platform_integrity_jailbreaking", label: "Platform Integrity / Jailbreaking" },
];

const WEBHOOK_EVENT_OPTIONS = [
  { value: "call_started", label: "Call Started" },
  { value: "call_ended", label: "Call Ended" },
  { value: "call_analyzed", label: "Call Analyzed" },
  { value: "transcript_updated", label: "Transcript Updated" },
  { value: "transfer_started", label: "Transfer Started" },
  { value: "transfer_bridged", label: "Transfer Bridged" },
  { value: "transfer_cancelled", label: "Transfer Cancelled" },
  { value: "transfer_ended", label: "Transfer Ended" },
];

interface VoiceOption {
  voice_id: string;
  voice_name: string;
  gender: "male" | "female";
  provider: string;
  accent: string | null;
  age: string | null;
}

export default function AgentSettingsPage() {
  const params = useParams();
  const agentId = params.id as string;
  const clientSlug = params.clientSlug as string;
  const { planAccess } = usePlanAccess();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentName, setAgentName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const isChat = agent?.platform === "retell-chat" || agent?.platform === "retell-sms";

  // Agent Config state -- populated from Retell API
  const [llmId, setLlmId] = useState<string | null>(null);
  const [language, setLanguage] = useState("en-US");
  const [model, setModel] = useState("gpt-4.1");
  const [voice, setVoice] = useState("nova");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [firstMessage, setFirstMessage] = useState("");

  // Chat agent settings
  const [autoCloseMessage, setAutoCloseMessage] = useState("");
  const [chatSilenceTimeout, setChatSilenceTimeout] = useState("60");

  // LLM advanced settings
  const [modelHighPriority, setModelHighPriority] = useState(false);
  const [toolCallStrictMode, setToolCallStrictMode] = useState(false);

  // Functions state
  const [functions, setFunctions] = useState<FunctionTool[]>([]);

  // Speech settings state
  const [responsiveness, setResponsiveness] = useState([0.5]);
  const [interruptionSensitivity, setInterruptionSensitivity] = useState([0.5]);
  const [backgroundSound, setBackgroundSound] = useState("off");
  const [backgroundVolume, setBackgroundVolume] = useState([0.5]);
  const [backchanneling, setBackchanneling] = useState(false);
  const [backchannelFrequency, setBackchannelFrequency] = useState([0.8]);
  const [backchannelWords, setBackchannelWords] = useState("");
  const [speechNormalization, setSpeechNormalization] = useState(false);
  const [reminderFrequency, setReminderFrequency] = useState("10");
  const [reminderMaxCount, setReminderMaxCount] = useState("1");
  const [pronunciationEntries, setPronunciationEntries] = useState<
    { id: string; word: string; phoneme: string; alphabet: string }[]
  >([]);

  // Voice model controls
  const [voiceModel, setVoiceModel] = useState<string | null>(null);
  const [voiceSpeed, setVoiceSpeed] = useState([1]);
  const [voiceTemperature, setVoiceTemperature] = useState([1]);
  const [voiceVolume, setVoiceVolume] = useState([1]);

  // Transcription state
  const [denoisingMode, setDenoisingMode] = useState("noise-cancellation");
  const [transcriptionMode, setTranscriptionMode] = useState("fast");
  const [vocabulary, setVocabulary] = useState("general");
  const [boostedKeywords, setBoostedKeywords] = useState("");

  // Call settings state
  const [voicemailDetection, setVoicemailDetection] = useState(false);
  const [voicemailAction, setVoicemailAction] = useState("hangup");
  const [voicemailText, setVoicemailText] = useState("");
  const [keypadInput, setKeypadInput] = useState(false);
  const [dtmfDigitLimit, setDtmfDigitLimit] = useState("");
  const [dtmfTerminationKey, setDtmfTerminationKey] = useState("");
  const [dtmfTimeout, setDtmfTimeout] = useState("5");
  const [silenceTimeout, setSilenceTimeout] = useState("30");
  const [maxDuration, setMaxDuration] = useState("3600");
  const [pauseBeforeSpeaking, setPauseBeforeSpeaking] = useState("0.4");
  const [ringDuration, setRingDuration] = useState("15");

  // Post call analysis state
  const [postCallModel, setPostCallModel] = useState("gpt-4.1");
  const [postCallItems, setPostCallItems] = useState<PostCallItem[]>([]);
  const [analysisSummaryPrompt, setAnalysisSummaryPrompt] = useState("");
  const [analysisSuccessfulPrompt, setAnalysisSuccessfulPrompt] = useState("");
  const [analysisSentimentPrompt, setAnalysisSentimentPrompt] = useState("");
  const [editingPostCallIdx, setEditingPostCallIdx] = useState<number | null>(null);

  // Security fallback state
  const [dataStorage, setDataStorage] = useState("everything");
  const [piiRedaction, setPiiRedaction] = useState(false);
  const [_piiCategories, setPiiCategories] = useState<string[]>([]);
  const [secureUrls, setSecureUrls] = useState(false);
  const [signedUrlExpiration, setSignedUrlExpiration] = useState("24");
  const [fallbackVoiceIds, setFallbackVoiceIds] = useState("");
  const [defaultDynamicVars, setDefaultDynamicVars] = useState("");

  // Knowledge base config state
  const [kbTopK, setKbTopK] = useState("5");
  const [kbFilterScore, setKbFilterScore] = useState("0.7");
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<string[]>([]);

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookTimeout, setWebhookTimeout] = useState("10");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [webhookEventsDialogOpen, setWebhookEventsDialogOpen] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);

  // Guardrail config state
  const [guardrailOutputTopics, setGuardrailOutputTopics] = useState<string[]>([]);
  const [guardrailInputTopics, setGuardrailInputTopics] = useState<string[]>([]);
  const [guardrailDialogOpen, setGuardrailDialogOpen] = useState(false);

  // IVR option state
  const [ivrEnabled, setIvrEnabled] = useState(false);
  const [ivrAction, setIvrAction] = useState<"hangup">("hangup");

  // Custom STT config state
  const [customSttConfig, setCustomSttConfig] = useState<{provider?: string; endpointing_ms?: number} | null>(null);

  // Voicemail detection timeout
  const [voicemailDetectionTimeout, setVoicemailDetectionTimeout] = useState("30");

  // Versioning state
  const [versions, setVersions] = useState<{ version: number; is_published: boolean; llm_model: string | null; voice_id: string | null; created_at: number | null }[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // MCPs state
  const [mcpServers, setMcpServers] = useState<
    { id: string; name: string; url: string }[]
  >([]);
  const [showTestPanel, setShowTestPanel] = useState(false);

  // Widget state
  const [widgetConfigId, setWidgetConfigId] = useState<string | null>(null);
  const [widgetDescription, setWidgetDescription] = useState("Our assistant is here to help.");
  const [widgetSaving, setWidgetSaving] = useState(false);

  // Live chat state (for chat agents)
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: "agent" | "user"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatStarting, setChatStarting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { color: dashboardColor } = useDashboardTheme();
  const { isCallActive, isAgentTalking, isMuted, transcript, startCall, stopCall, toggleMute } = useRetellCall();
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Voice options from Retell
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);

  // Per-minute cost computation based on current selections
  const voiceProviderKey = useMemo(() => {
    if (isChat) return "openai";
    const vo = voiceOptions.find((v) => v.voice_id === voice);
    return vo?.provider?.toLowerCase() || "openai";
  }, [isChat, voiceOptions, voice]);

  const costBreakdown = useMemo(() => {
    const infra = RETELL_INFRA_COST;
    const telephony = !isChat ? TELEPHONY_COST : 0;
    const llm = LLM_MODEL_COSTS[model] ?? 0.045;
    const vp = VOICE_PROVIDER_COSTS[voiceProviderKey] ?? 0;
    const kb = agent && (agent as unknown as Record<string, unknown>).knowledge_base_id ? ADDON_COSTS.knowledgeBase : 0;
    const denoising = denoisingMode === "noise-and-background-speech-cancellation" ? ADDON_COSTS.advancedDenoising : 0;
    const pii = piiRedaction ? ADDON_COSTS.piiRemoval : 0;
    const total = infra + telephony + llm + vp + kb + denoising + pii;
    return {
      infrastructure: infra,
      telephony,
      llm,
      voiceProvider: vp,
      knowledgeBase: kb,
      advancedDenoising: denoising,
      piiRemoval: pii,
      total: Math.round(total * 1000) / 1000,
    };
  }, [model, voiceProviderKey, isChat, agent, denoisingMode, piiRedaction]);
  const [voicesLoading, setVoicesLoading] = useState(false);

  // Audio device selection
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  useEffect(() => {
    // Load saved preference
    const saved = localStorage.getItem("preferred-audio-device");
    if (saved) setSelectedDeviceId(saved);

    async function loadDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === "audioinput");
        setAudioDevices(audioInputs);
      } catch {
        // Permission denied or not available
      }
    }
    loadDevices();
  }, []);

  // AI Analysis state
  const [aiConfigId, setAiConfigId] = useState<string | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [summaryEnabled, setSummaryEnabled] = useState(true);
  const [evaluationEnabled, setEvaluationEnabled] = useState(true);
  const [autoTaggingEnabled, setAutoTaggingEnabled] = useState(true);
  const [misunderstoodEnabled, setMisunderstoodEnabled] = useState(false);
  const [autoTaggingMode, setAutoTaggingMode] = useState<string | null>(null);
  const [summaryPrompt, setSummaryPrompt] = useState(
    "Summarize this conversation in 2-3 sentences. Focus on the key topics discussed, the customer's main concern, and the outcome or resolution."
  );
  const [evaluationPrompt, setEvaluationPrompt] = useState(
    "Evaluate whether this conversation was successful. Consider: Was the customer's question answered? Was the issue resolved? Was an appointment booked? Rate as TRUE if the primary goal was achieved."
  );
  const [autoTaggingPrompt, setAutoTaggingPrompt] = useState(
    "Analyze the conversation and assign relevant topic tags. Consider the main subject discussed, the type of inquiry, and any specific products or services mentioned."
  );

  // Call duration timer
  useEffect(() => {
    if (isCallActive) {
      setCallDuration(0);
      durationRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
    }
    return () => { if (durationRef.current) clearInterval(durationRef.current); };
  }, [isCallActive]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Fetch agent metadata from Supabase
  const fetchAgent = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (error) {
      toast.error("Failed to load agent");
      return;
    }

    setAgent(data);
    setAgentName(data.name ?? "");
  }, [agentId]);

  // Fetch agent config from Retell API
  const fetchConfig = useCallback(async () => {
    if (!agentId) return;
    try {
      const res = await fetch(`/api/agents/${agentId}/config`);
      if (!res.ok) {
        // Agent may not have a linked Retell config yet — use defaults silently
        console.warn("Could not load agent config from provider, using defaults");
        return;
      }
      const data = await res.json();

      // Main fields
      setLlmId(data.llm_id ?? null);
      setSystemPrompt(data.system_prompt ?? "");
      setModel(data.llm_model ?? "gpt-4.1");
      setVoice(data.voice ?? "nova");
      setLanguage(data.language ?? "en-US");
      setFirstMessage(data.first_message ?? "");
      setModelHighPriority(data.model_high_priority ?? false);
      setToolCallStrictMode(data.tool_call_strict_mode ?? false);

      // Chat settings
      const cts = data.chat_settings;
      if (cts) {
        setAutoCloseMessage(cts.auto_close_message ?? "");
        setChatSilenceTimeout(
          cts.end_chat_after_silence_ms != null
            ? String(cts.end_chat_after_silence_ms / 60000)
            : "60"
        );
      }

      // Functions — preserve all fields from Retell (type, parameters, etc.)
      if (Array.isArray(data.functions)) {
        setFunctions(
          data.functions.map(
            (fn: Record<string, unknown>, idx: number) => ({
              ...fn,
              id: (fn.id as string) ?? String(idx),
              name: (fn.name as string) ?? "",
              description: (fn.description as string) ?? "",
            })
          )
        );
      }

      // Speech settings
      const ss = data.speech_settings;
      if (ss) {
        setBackgroundSound(ss.background_sound ?? "off");
        setBackgroundVolume([ss.background_sound_volume ?? 0.5]);
        setResponsiveness([ss.responsiveness ?? 0.5]);
        setInterruptionSensitivity([ss.interruption_sensitivity ?? 0.5]);
        setBackchanneling(ss.enable_backchanneling ?? false);
        setBackchannelFrequency([ss.backchannel_frequency ?? 0.8]);
        if (Array.isArray(ss.backchannel_words)) {
          setBackchannelWords(ss.backchannel_words.join(", "));
        } else {
          setBackchannelWords(ss.backchannel_words ?? "");
        }
        setSpeechNormalization(ss.speech_normalization ?? false);
        setReminderFrequency(
          ss.reminder_frequency_sec != null ? String(ss.reminder_frequency_sec) : "10"
        );
        setReminderMaxCount(
          ss.reminder_max_count != null ? String(ss.reminder_max_count) : "1"
        );
        if (Array.isArray(ss.pronunciation)) {
          setPronunciationEntries(
            ss.pronunciation.map(
              (p: Record<string, unknown>, idx: number) => ({
                id: String(idx),
                word: (p.word as string) ?? "",
                phoneme: (p.phoneme as string) ?? "",
                alphabet: (p.alphabet as string) ?? "ipa",
              })
            )
          );
        }
      }

      // Voice model controls
      setVoiceModel(data.voice_model ?? null);
      setVoiceSpeed([data.voice_speed ?? 1]);
      setVoiceTemperature([data.voice_temperature ?? 1]);
      setVoiceVolume([data.volume ?? 1]);

      // Realtime transcription
      const rt = data.realtime_transcription;
      if (rt) {
        setDenoisingMode(rt.denoising_mode ?? "noise-cancellation");
        setTranscriptionMode(rt.transcription_mode ?? "fast");
        setVocabulary(rt.vocabulary_specialization ?? "general");
        if (Array.isArray(rt.boosted_keywords)) {
          setBoostedKeywords(rt.boosted_keywords.join(", "));
        } else {
          setBoostedKeywords(rt.boosted_keywords ?? "");
        }
      }

      // Call settings
      const cs = data.call_settings;
      if (cs) {
        setVoicemailDetection(cs.voicemail_detection ?? false);
        if (cs.voicemail_option) {
          setVoicemailAction(cs.voicemail_option.type ?? "hangup");
          setVoicemailText(cs.voicemail_option.text ?? "");
        } else {
          setVoicemailAction("hangup");
          setVoicemailText("");
        }
        setKeypadInput(cs.keypad_input_detection ?? false);
        if (cs.dtmf_options) {
          setDtmfDigitLimit(
            cs.dtmf_options.digit_limit != null ? String(cs.dtmf_options.digit_limit) : ""
          );
          setDtmfTerminationKey(cs.dtmf_options.termination_key ?? "");
          setDtmfTimeout(
            cs.dtmf_options.timeout_ms != null ? String(cs.dtmf_options.timeout_ms / 1000) : "5"
          );
        }
        setSilenceTimeout(
          cs.end_call_after_silence != null
            ? String(cs.end_call_after_silence / 1000)
            : "30"
        );
        setMaxDuration(
          cs.max_call_duration != null
            ? String(cs.max_call_duration / 1000)
            : "3600"
        );
        setPauseBeforeSpeaking(
          cs.begin_message_delay != null
            ? String(cs.begin_message_delay / 1000)
            : "0.4"
        );
        setRingDuration(
          cs.ring_duration != null ? String(cs.ring_duration / 1000) : "15"
        );
      }

      // Post call analysis
      const pca = data.post_call_analysis;
      if (pca) {
        setPostCallModel(pca.model ?? "gpt-4.1");
        if (Array.isArray(pca.data)) {
          setPostCallItems(pca.data.map((item: Record<string, unknown>) => ({
            name: (item.name as string) ?? "",
            description: (item.description as string) ?? "",
            type: (item.type as string) ?? "string",
            choices: Array.isArray(item.choices) ? item.choices : undefined,
            examples: Array.isArray(item.examples) ? item.examples : undefined,
          })));
        }
        setAnalysisSummaryPrompt(pca.analysis_summary_prompt ?? "");
        setAnalysisSuccessfulPrompt(pca.analysis_successful_prompt ?? "");
        setAnalysisSentimentPrompt(pca.analysis_sentiment_prompt ?? "");
      }

      // Security fallback
      const sf = data.security_fallback;
      if (sf) {
        setDataStorage(sf.data_storage_setting ?? "everything");
        setPiiRedaction(sf.pii_redaction ?? false);
        setPiiCategories(Array.isArray(sf.pii_categories) ? sf.pii_categories : []);
        setSecureUrls(sf.secure_urls ?? false);
        setSignedUrlExpiration(
          sf.signed_url_expiration_hours != null ? String(sf.signed_url_expiration_hours) : "24"
        );
        if (Array.isArray(sf.fallback_voice_ids)) {
          setFallbackVoiceIds(sf.fallback_voice_ids.join(", "));
        } else {
          setFallbackVoiceIds(sf.fallback_voice_ids ?? "");
        }
        if (
          sf.default_dynamic_vars != null &&
          typeof sf.default_dynamic_vars === "object"
        ) {
          setDefaultDynamicVars(
            JSON.stringify(sf.default_dynamic_vars, null, 2)
          );
        } else {
          setDefaultDynamicVars(sf.default_dynamic_vars ?? "");
        }
      }

      // Knowledge base config
      if (data.kb_config) {
        setKbTopK(String(data.kb_config.top_k ?? 5));
        setKbFilterScore(String(data.kb_config.filter_score ?? 0.7));
      }
      if (Array.isArray(data.knowledge_base_ids)) {
        setKnowledgeBaseIds(data.knowledge_base_ids);
      }

      // Webhook
      const wh = data.webhook;
      if (wh) {
        setWebhookUrl(wh.url ?? "");
        setWebhookTimeout(
          wh.timeout_ms != null ? String(wh.timeout_ms / 1000) : "10"
        );
      }

      // MCPs
      if (Array.isArray(data.mcps)) {
        setMcpServers(
          data.mcps.map(
            (mcp: Record<string, unknown>, idx: number) => ({
              id: (mcp.id as string) ?? String(idx),
              name: (mcp.name as string) ?? "",
              url: (mcp.url as string) ?? "",
            })
          )
        );
      }

      // Guardrail config
      if (data.guardrail_config) {
        setGuardrailOutputTopics(data.guardrail_config.output_topics ?? []);
        setGuardrailInputTopics(data.guardrail_config.input_topics ?? []);
      }

      // Webhook events
      if (Array.isArray(data.webhook_events)) {
        setWebhookEvents(data.webhook_events);
      }

      // IVR option
      if (data.ivr_option) {
        setIvrEnabled(true);
        if (data.ivr_option.action?.type) {
          setIvrAction(data.ivr_option.action.type);
        }
      }

      // Custom STT config
      if (data.custom_stt_config) {
        setCustomSttConfig(data.custom_stt_config);
        setTranscriptionMode("custom");
      }

      // Voicemail detection timeout
      if (data.voicemail_detection_timeout_ms != null) {
        setVoicemailDetectionTimeout(String(data.voicemail_detection_timeout_ms / 1000));
      }
    } catch (err) {
      console.error("Failed to fetch agent config:", err);
      toast.error("Failed to load agent configuration");
    }
  }, [agentId]);

  // Fetch available voices from Retell
  const fetchVoices = useCallback(async () => {
    if (!agentId) return;
    setVoicesLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/voices`);
      if (res.ok) {
        const data = await res.json();
        setVoiceOptions(data);
      }
    } catch {
      // Use defaults if fetch fails
    } finally {
      setVoicesLoading(false);
    }
  }, [agentId]);

  // Fetch widget config
  const fetchWidgetConfig = useCallback(async () => {
    const res = await fetch(`/api/agents/${agentId}/widget-config`);
    if (!res.ok) return;
    let config = await res.json();

    if (!config) {
      // Initialize a default config via the API
      const initRes = await fetch(`/api/agents/${agentId}/widget-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (initRes.ok) config = await initRes.json();
    }

    if (config) {
      setWidgetConfigId(config.id);
      setWidgetDescription(config.description ?? "Our assistant is here to help.");
    }
  }, [agentId]);

  // Fetch AI analysis config
  const fetchAiConfig = useCallback(async () => {
    const res = await fetch(`/api/agents/${agentId}/ai-analysis-config`);
    if (!res.ok) return;
    let config = await res.json();

    if (!config) {
      // Initialize a default config via the API
      const initRes = await fetch(`/api/agents/${agentId}/ai-analysis-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (initRes.ok) config = await initRes.json();
    }

    if (config) {
      setAiConfigId(config.id);
      setSummaryEnabled(config.summary_enabled ?? true);
      setSummaryPrompt(config.summary_custom_prompt ?? summaryPrompt);
      setEvaluationEnabled(config.evaluation_enabled ?? true);
      setEvaluationPrompt(config.evaluation_custom_prompt ?? evaluationPrompt);
      setAutoTaggingEnabled(config.auto_tagging_enabled ?? true);
      setAutoTaggingMode(config.auto_tagging_mode ?? null);
      setAutoTaggingPrompt(config.auto_tagging_custom_prompt ?? autoTaggingPrompt);
      setMisunderstoodEnabled(config.misunderstood_queries_enabled ?? false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Fetch all on mount
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([fetchAgent(), fetchConfig(), fetchWidgetConfig(), fetchAiConfig(), fetchVoices()]);
      setLoading(false);
    }
    loadAll();
  }, [fetchAgent, fetchConfig, fetchWidgetConfig, fetchAiConfig, fetchVoices]);

  // Quick-publish a partial config update (language or voice) so the change
  // takes effect immediately without requiring the user to hit "Publish".
  const quickPublish = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!agentId) return;
      try {
        const res = await fetch(`/api/agents/${agentId}/config`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error();
        toast.success("Applied", { duration: 1500 });
      } catch {
        toast.error("Failed to apply change");
      }
    },
    [agentId]
  );

  // Wrappers that update local state AND immediately publish to Retell
  const handleLanguageChange = useCallback(
    (value: string) => {
      setLanguage(value);
      // Send the current system prompt + llmId so the API can inject /
      // strip the language directive in the prompt sent to Retell.
      quickPublish({
        language: value,
        system_prompt: systemPrompt,
        ...(llmId ? { llm_id: llmId } : {}),
      });
    },
    [quickPublish, systemPrompt, llmId]
  );

  const handleVoiceChange = useCallback(
    (value: string) => {
      setVoice(value);
      quickPublish({ voice: value });
    },
    [quickPublish]
  );

  // Widget save
  const handleWidgetSave = async () => {
    setWidgetSaving(true);
    const res = await fetch(`/api/agents/${agentId}/widget-config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(widgetConfigId ? { id: widgetConfigId } : {}),
        description: widgetDescription,
      }),
    });
    if (!res.ok) {
      toast.error("Failed to save widget settings");
    } else {
      toast.success("Widget settings saved");
    }
    setWidgetSaving(false);
  };

  // AI Analysis save
  const handleAiSave = async () => {
    setAiSaving(true);
    const res = await fetch(`/api/agents/${agentId}/ai-analysis-config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(aiConfigId ? { id: aiConfigId } : {}),
        summary_enabled: summaryEnabled,
        summary_custom_prompt: summaryPrompt,
        evaluation_enabled: evaluationEnabled,
        evaluation_custom_prompt: evaluationPrompt,
        auto_tagging_enabled: autoTaggingEnabled,
        auto_tagging_mode: autoTaggingMode,
        auto_tagging_custom_prompt: autoTaggingPrompt,
        misunderstood_queries_enabled: misunderstoodEnabled,
      }),
    });

    if (!res.ok) {
      toast.error("Failed to save AI analysis config");
    } else {
      toast.success("AI analysis config saved");
    }
    setAiSaving(false);
  };

  // Call handlers
  async function handleStartCall() {
    setIsConnecting(true);
    await startCall(agentId, selectedDeviceId ? { captureDeviceId: selectedDeviceId } : undefined);
    setIsConnecting(false);
  }

  function handleEndCall() { stopCall(); }

  function handleResetCall() {
    stopCall();
    setCallDuration(0);
    setTimeout(() => handleStartCall(), 500);
  }

  // Chat handlers (for chat agents)
  async function startChatSession() {
    setChatStarting(true);
    setChatMessages([]);
    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      if (!res.ok) throw new Error("Failed to create chat session");
      const data = await res.json();
      setChatSessionId(data.chat_id);
      // Show the agent's greeting message
      const greeting = data.begin_message || firstMessage;
      if (greeting) {
        setChatMessages([{ role: "agent", content: greeting }]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start chat");
    } finally {
      setChatStarting(false);
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || !chatSessionId || chatSending) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatSending(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", chat_id: chatSessionId, content: userMsg }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      if (data.messages?.length > 0) {
        setChatMessages((prev) => [
          ...prev,
          ...data.messages.map((content: string) => ({ role: "agent" as const, content })),
        ]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setChatSending(false);
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // End and save chat session on unmount or navigation
  const chatSessionIdRef = useRef(chatSessionId);
  chatSessionIdRef.current = chatSessionId;
  useEffect(() => {
    return () => {
      if (chatSessionIdRef.current) {
        fetch(`/api/agents/${agentId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end", chat_id: chatSessionIdRef.current }),
        }).catch(() => {});
      }
    };
  }, [agentId]);

  // Save agent name to Supabase + publish config
  const handleSave = async () => {
    setSaving(true);

    // Save name if changed
    if (agentName && agentName !== agent?.name) {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agentName }),
      });

      if (!res.ok) {
        toast.error("Failed to save name");
        setSaving(false);
        return;
      }
      setAgent((prev) => (prev ? { ...prev, name: agentName } : prev));
    }

    // Also publish config
    await handlePublish();
    setSaving(false);
  };

  // Publish config to Retell API
  const handlePublish = async () => {
    if (!agentId) return;
    setPublishing(true);

    // Parse comma-separated values back to arrays
    const parsedBoostedKeywords = boostedKeywords
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedFallbackVoiceIds = fallbackVoiceIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Parse default dynamic vars from JSON string
    let parsedDynamicVars: Record<string, string> | undefined;
    if (defaultDynamicVars.trim()) {
      try {
        parsedDynamicVars = JSON.parse(defaultDynamicVars);
      } catch {
        toast.error(
          "Invalid JSON in Default Dynamic Variables. Please fix and try again."
        );
        setPublishing(false);
        return;
      }
    }

    // Build full config payload matching the API structure
    const payload: Record<string, unknown> = {
      ...(llmId && { llm_id: llmId }),
      agent_name: agentName || undefined,
      language,
      system_prompt: systemPrompt,
      llm_model: model,
      first_message: firstMessage,
      model_high_priority: modelHighPriority,
      tool_call_strict_mode: toolCallStrictMode,
      kb_config: {
        top_k: parseInt(kbTopK) || 5,
        filter_score: parseFloat(kbFilterScore) || 0.7,
      },
      ...(knowledgeBaseIds.length > 0 ? { knowledge_base_ids: knowledgeBaseIds } : {}),
      functions: functions.map(({ id, name, description, ...rest }) => ({
        ...rest,
        id,
        name,
        description,
      })),
      post_call_analysis: {
        model: postCallModel,
        data: postCallItems.length > 0 ? postCallItems : undefined,
        analysis_summary_prompt: analysisSummaryPrompt || undefined,
        analysis_successful_prompt: analysisSuccessfulPrompt || undefined,
        analysis_sentiment_prompt: analysisSentimentPrompt || undefined,
      },
      security_fallback: {
        data_storage_setting: dataStorage,
        secure_urls: secureUrls,
        ...(secureUrls ? { signed_url_expiration_hours: parseFloat(signedUrlExpiration) || 24 } : {}),
        ...(isChat ? {} : { fallback_voice_ids: parsedFallbackVoiceIds }),
        default_dynamic_vars: parsedDynamicVars,
      },
      mcps: mcpServers.map((mcp) => ({
        id: mcp.id,
        name: mcp.name,
        url: mcp.url,
      })),
      webhook: {
        url: webhookUrl.trim() || null,
        timeout_ms: (parseFloat(webhookTimeout) || 10) * 1000,
      },
      webhook_events: webhookEvents.length > 0 ? webhookEvents : null,
      guardrail_config: (guardrailOutputTopics.length > 0 || guardrailInputTopics.length > 0)
        ? { output_topics: guardrailOutputTopics, input_topics: guardrailInputTopics }
        : null,
    };

    // Chat-only settings
    if (isChat) {
      payload.chat_settings = {
        auto_close_message: autoCloseMessage || null,
        end_chat_after_silence_ms: (parseFloat(chatSilenceTimeout) || 60) * 60000,
      };
    }

    // Voice-only settings
    if (!isChat) {
      payload.voice = voice;
      payload.voice_model = voiceModel;
      payload.voice_speed = voiceSpeed[0];
      payload.voice_temperature = voiceTemperature[0];
      payload.volume = voiceVolume[0];
      const parsedBackchannelWords = backchannelWords
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      payload.speech_settings = {
        background_sound: backgroundSound,
        background_sound_volume: backgroundVolume[0],
        responsiveness: responsiveness[0],
        interruption_sensitivity: interruptionSensitivity[0],
        enable_backchanneling: backchanneling,
        backchannel_frequency: backchannelFrequency[0],
        backchannel_words: parsedBackchannelWords.length > 0 ? parsedBackchannelWords : undefined,
        speech_normalization: speechNormalization,
        reminder_frequency_sec: parseFloat(reminderFrequency) || 10,
        reminder_max_count: parseInt(reminderMaxCount, 10) || 1,
        pronunciation: pronunciationEntries.length > 0
          ? pronunciationEntries.map(({ word, phoneme, alphabet }) => ({ word, phoneme, alphabet }))
          : undefined,
      };
      payload.realtime_transcription = {
        denoising_mode: denoisingMode,
        // Retell only accepts "fast" or "accurate" for stt_mode.
        // When using custom STT, skip sending stt_mode — custom_stt_config drives it.
        transcription_mode: transcriptionMode === "custom" ? undefined : transcriptionMode,
        vocabulary_specialization: vocabulary.trim(),
        boosted_keywords: parsedBoostedKeywords,
      };
      // Build voicemail option (flat structure -- API route wraps in { action } for Retell)
      let voicemailOption: Record<string, unknown> | null = null;
      if (voicemailDetection) {
        if (voicemailAction === "hangup") {
          voicemailOption = { type: "hangup" };
        } else if ((voicemailAction === "prompt" || voicemailAction === "static_text") && voicemailText.trim()) {
          voicemailOption = { type: voicemailAction, text: voicemailText.trim() };
        }
      }
      // Build DTMF options
      let dtmfOptions: Record<string, unknown> | null = null;
      if (keypadInput) {
        dtmfOptions = {
          ...(dtmfDigitLimit ? { digit_limit: parseInt(dtmfDigitLimit, 10) } : {}),
          ...(dtmfTerminationKey ? { termination_key: dtmfTerminationKey } : {}),
          timeout_ms: (parseFloat(dtmfTimeout) || 5) * 1000,
        };
      }
      payload.call_settings = {
        voicemail_detection: voicemailDetection,
        voicemail_option: voicemailOption,
        keypad_input_detection: keypadInput,
        dtmf_options: dtmfOptions,
        end_call_after_silence: parseFloat(silenceTimeout) * 1000,
        max_call_duration: parseFloat(maxDuration) * 1000,
        begin_message_delay: parseFloat(pauseBeforeSpeaking) * 1000,
        ring_duration: parseFloat(ringDuration) * 1000,
      };
      payload.ivr_option = ivrEnabled ? { action: { type: ivrAction } } : null;
      payload.voicemail_detection_timeout_ms = voicemailDetection
        ? (parseFloat(voicemailDetectionTimeout) || 30) * 1000
        : undefined;
      if (transcriptionMode === "custom" && customSttConfig) {
        payload.custom_stt_config = customSttConfig;
      }
    }

    try {
      const res = await fetch(`/api/agents/${agentId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? "Failed to publish config");
      }

      toast.success("Agent configuration published");
      setHasUnpublishedChanges(false);
    } catch (err) {
      console.error("Failed to publish agent config:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to publish configuration"
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleNameBlur = async () => {
    setIsEditingName(false);
    if (agentName && agentName !== agent?.name) {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agentName }),
      });
      if (!res.ok) {
        toast.error("Failed to save name");
      } else {
        setAgent((prev) => (prev ? { ...prev, name: agentName } : prev));
        // Sync name to Retell so it stays in sync with our DB
        quickPublish({ agent_name: agentName });
      }
    }
  };

  function addFunction(toolType?: string) {
    const type = toolType || "custom";
    const base: FunctionTool = { id: Date.now().toString(), name: "", description: "", type };
    const typeDefaults: Record<string, Partial<FunctionTool>> = {
      agent_swap: { agent_id: "", post_call_analysis_setting: "both_agents" },
      send_sms: { sms_content: { type: "predefined", content: "" } },
      mcp: { mcp_id: "" },
      extract_dynamic_variable: { variables: [] },
      transfer_call: {
        transfer_destination: { type: "predefined", number: "" },
        transfer_option: { type: "cold_transfer" },
      },
      custom: {
        url: "",
        method: "POST",
        speak_after_execution: true,
        speak_during_execution: false,
      },
      check_availability_cal: {},
      book_appointment_cal: {},
      press_digit: {},
    };
    setFunctions((prev) => [...prev, { ...base, ...(typeDefaults[type] || {}) }]);
  }

  function removeFunction(id: string) {
    setFunctions((prev) => prev.filter((f) => f.id !== id));
  }

  function updateTool(id: string, updates: Partial<FunctionTool>) {
    setFunctions((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }

  async function fetchVersions() {
    if (!agent?.id) return;
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setVersionsLoading(false);
    }
  }

  async function publishVersion() {
    if (!agent?.id) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/publish`, { method: "POST" });
      if (res.ok) {
        toast.success("Agent version published");
        setHasUnpublishedChanges(false);
        fetchVersions();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to publish");
      }
    } catch {
      toast.error("Failed to publish agent version");
    } finally {
      setPublishing(false);
    }
  }

  async function restoreVersion(version: number) {
    if (!agent?.id) return;
    setRestoringVersion(version);
    try {
      const res = await fetch(`/api/agents/${agent.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      if (res.ok) {
        toast.success(`Restored to version ${version}`);
        setHasUnpublishedChanges(true);
        // Reload the page to pick up restored config
        window.location.reload();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to restore version");
      }
    } catch {
      toast.error("Failed to restore version");
    } finally {
      setRestoringVersion(null);
    }
  }

  function addMcpServer() {
    setMcpServers((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", url: "" },
    ]);
  }

  function removeMcpServer(id: string) {
    setMcpServers((prev) => prev.filter((s) => s.id !== id));
  }

  async function testWebhook() {
    if (!webhookUrl.trim()) {
      toast.error("Enter a webhook URL first");
      return;
    }
    setWebhookTesting(true);
    try {
      // Proxy through server-side endpoint to avoid CORS issues
      const res = await fetch(`/api/agents/${agentId}/webhook-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success("Webhook test successful");
      } else if (res.ok) {
        toast.error(`Webhook returned ${data.status}`);
      } else {
        toast.error(data.error || "Failed to reach webhook URL");
      }
    } catch {
      toast.error("Failed to test webhook");
    } finally {
      setWebhookTesting(false);
    }
  }

  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(agentId);
    setCopiedId(true);
    toast.success("Agent ID copied");
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-10 w-full max-w-md rounded-md" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border p-6 space-y-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <FeatureGate feature="agent_settings">
    <div className="p-6 space-y-6">
      {/* Hero Header */}
      <div className="rounded-xl border bg-primary/5 dark:bg-primary/5 p-6 animate-fade-in">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <Input
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    onBlur={handleNameBlur}
                    onKeyDown={(e) => e.key === "Enter" && setIsEditingName(false)}
                    autoFocus
                    className="text-2xl font-bold h-auto py-0 px-1 border-primary w-auto bg-white dark:bg-background"
                  />
                ) : (
                  <h1 className="text-3xl font-bold tracking-tight">{agentName}</h1>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsEditingName(!isEditingName)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Badge variant="outline" className="ml-1 text-muted-foreground border-border">
                  {isChat ? "Chat" : "Voice"}
                </Badge>
              </div>
              <button
                onClick={handleCopyId}
                className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
              >
                <span className="font-mono bg-white/60 dark:bg-white/5 px-2 py-0.5 rounded border border-border/50">
                  {agentId.slice(0, 8)}...{agentId.slice(-4)}
                </span>
                {copiedId ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTestPanel((v) => !v)} className="bg-white/80 dark:bg-background hover:bg-white dark:hover:bg-accent">
              <Play className="w-4 h-4 mr-2" />
              {isChat ? "Test Chat" : "Test Call"}
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
              onClick={handlePublish}
              disabled={publishing}
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Publish
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList className="animate-fade-in bg-transparent border-b border-border/50 rounded-none p-0 h-auto">
          <TabsTrigger value="config" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none rounded-none px-4 py-2">Agent Config</TabsTrigger>
          <TabsTrigger value="widget" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none rounded-none px-4 py-2">Widget</TabsTrigger>
          <TabsTrigger value="ai-analysis" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none rounded-none px-4 py-2">AI Analysis</TabsTrigger>
        </TabsList>

        {/* Per-Minute Cost Indicator */}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground animate-fade-in">
          <DollarSign className="w-3 h-3" />
          <span>Estimated cost: <span className="font-medium text-foreground">${costBreakdown.total.toFixed(3)}/min</span></span>
        </div>

        <TabsContent value="config" className="mt-6">
          <div className={`grid grid-cols-1 gap-6 ${showTestPanel ? "lg:grid-cols-[1fr_280px_300px]" : "lg:grid-cols-[2fr_1fr]"}`}>
            {/* Left - Main Config */}
            <div className="space-y-6">
              {/* Core Settings Card */}
              <Card className="overflow-hidden rounded-xl">
                <div className="px-6 pt-5 pb-1">
                  <h3 className="font-semibold text-sm">Core Configuration</h3>
                  <p className="text-xs text-muted-foreground">
                    {isChat ? "Language, model, and behavior" : "Language, model, voice, and behavior"}
                  </p>
                </div>
                <CardContent className="p-6 pt-4 space-y-5">
                  <div className={`grid grid-cols-1 ${isChat ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-[1fr_1.5fr_2fr_1.2fr]"} gap-x-6 gap-y-4`}>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs font-medium">
                        <Languages className="w-3.5 h-3.5 text-muted-foreground" />
                        Language
                      </Label>
                      <Select value={language} onValueChange={handleLanguageChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value="en-US">English (US)</SelectItem>
                          <SelectItem value="en-GB">English (UK)</SelectItem>
                          <SelectItem value="en-AU">English (AU)</SelectItem>
                          <SelectItem value="en-IN">English (India)</SelectItem>
                          <SelectItem value="es-ES">Spanish (Spain)</SelectItem>
                          <SelectItem value="es-419">Spanish (Latin America)</SelectItem>
                          <SelectItem value="fr-FR">French (France)</SelectItem>
                          <SelectItem value="fr-CA">French (Canada)</SelectItem>
                          <SelectItem value="de-DE">German</SelectItem>
                          <SelectItem value="it-IT">Italian</SelectItem>
                          <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
                          <SelectItem value="pt-PT">Portuguese (Portugal)</SelectItem>
                          <SelectItem value="nl-NL">Dutch</SelectItem>
                          <SelectItem value="zh-CN">Chinese (Mandarin)</SelectItem>
                          <SelectItem value="ja-JP">Japanese</SelectItem>
                          <SelectItem value="ko-KR">Korean</SelectItem>
                          <SelectItem value="hi-IN">Hindi</SelectItem>
                          <SelectItem value="ar-SA">Arabic</SelectItem>
                          <SelectItem value="ru-RU">Russian</SelectItem>
                          <SelectItem value="pl-PL">Polish</SelectItem>
                          <SelectItem value="tr-TR">Turkish</SelectItem>
                          <SelectItem value="vi-VN">Vietnamese</SelectItem>
                          <SelectItem value="th-TH">Thai</SelectItem>
                          <SelectItem value="sv-SE">Swedish</SelectItem>
                          <SelectItem value="da-DK">Danish</SelectItem>
                          <SelectItem value="no-NO">Norwegian</SelectItem>
                          <SelectItem value="fi-FI">Finnish</SelectItem>
                          <SelectItem value="uk-UA">Ukrainian</SelectItem>
                          <SelectItem value="el-GR">Greek</SelectItem>
                          <SelectItem value="cs-CZ">Czech</SelectItem>
                          <SelectItem value="ro-RO">Romanian</SelectItem>
                          <SelectItem value="hu-HU">Hungarian</SelectItem>
                          <SelectItem value="bg-BG">Bulgarian</SelectItem>
                          <SelectItem value="id-ID">Indonesian</SelectItem>
                          <SelectItem value="sk-SK">Slovak</SelectItem>
                          <SelectItem value="multi">Multilingual (auto-detect)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs font-medium">
                        <BrainCircuit className="w-3.5 h-3.5 text-muted-foreground" />
                        AI Model
                      </Label>
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4.1-nano">
                            <span className="flex items-center justify-between gap-3 w-full">
                              GPT-4.1 Nano
                              <span className="text-[10px] text-muted-foreground tabular-nums">${(LLM_MODEL_COSTS["gpt-4.1-nano"] ?? 0).toFixed(3)}/min</span>
                            </span>
                          </SelectItem>
                          <SelectItem value="gpt-4.1-mini">
                            <span className="flex items-center justify-between gap-3 w-full">
                              GPT-4.1 Mini
                              <span className="text-[10px] text-muted-foreground tabular-nums">${(LLM_MODEL_COSTS["gpt-4.1-mini"] ?? 0).toFixed(3)}/min</span>
                            </span>
                          </SelectItem>
                          <SelectItem value="gpt-4.1">
                            <span className="flex items-center justify-between gap-3 w-full">
                              GPT-4.1
                              <span className="text-[10px] text-muted-foreground tabular-nums">${(LLM_MODEL_COSTS["gpt-4.1"] ?? 0).toFixed(3)}/min</span>
                            </span>
                          </SelectItem>
                          {(!planAccess || planAccess.llm_selection === "full") && (
                            <>
                              <SelectItem value="gpt-4o">
                                <span className="flex items-center justify-between gap-3 w-full">
                                  GPT-4o
                                  <span className="text-[10px] text-muted-foreground tabular-nums">${(LLM_MODEL_COSTS["gpt-4o"] ?? 0).toFixed(3)}/min</span>
                                </span>
                              </SelectItem>
                              <SelectItem value="gpt-4o-mini">
                                <span className="flex items-center justify-between gap-3 w-full">
                                  GPT-4o Mini
                                  <span className="text-[10px] text-muted-foreground tabular-nums">${(LLM_MODEL_COSTS["gpt-4o-mini"] ?? 0).toFixed(3)}/min</span>
                                </span>
                              </SelectItem>
                              <SelectItem value="gpt-5">
                                <span className="flex items-center justify-between gap-3 w-full">
                                  GPT-5
                                  <span className="text-[10px] text-muted-foreground tabular-nums">${(LLM_MODEL_COSTS["gpt-5"] ?? 0.045).toFixed(3)}/min</span>
                                </span>
                              </SelectItem>
                              <SelectItem value="gpt-5-mini">
                                <span className="flex items-center justify-between gap-3 w-full">
                                  GPT-5 Mini
                                  <span className="text-[10px] text-muted-foreground tabular-nums">${(LLM_MODEL_COSTS["gpt-5-mini"] ?? 0.012).toFixed(3)}/min</span>
                                </span>
                              </SelectItem>
                              <SelectItem value="gpt-5-nano">
                                <span className="flex items-center justify-between gap-3 w-full">
                                  GPT-5 Nano
                                  <span className="text-[10px] text-muted-foreground tabular-nums">${(LLM_MODEL_COSTS["gpt-5-nano"] ?? 0.004).toFixed(3)}/min</span>
                                </span>
                              </SelectItem>
                              <SelectItem value="claude-4.5-sonnet">
                                <span className="flex items-center justify-between gap-3 w-full">
                                  Claude 4.5 Sonnet
                                  <span className="text-[10px] text-muted-foreground tabular-nums">${(LLM_MODEL_COSTS["claude-4.5-sonnet"] ?? 0.08).toFixed(3)}/min</span>
                                </span>
                              </SelectItem>
                              <SelectItem value="claude-4.5-haiku">
                                <span className="flex items-center justify-between gap-3 w-full">
                                  Claude 4.5 Haiku
                                  <span className="text-[10px] text-muted-foreground tabular-nums">${(LLM_MODEL_COSTS["claude-4.5-haiku"] ?? 0.01).toFixed(3)}/min</span>
                                </span>
                              </SelectItem>
                              <SelectItem value="gemini-2.5-flash">
                                <span className="flex items-center justify-between gap-3 w-full">
                                  Gemini 2.5 Flash
                                  <span className="text-[10px] text-muted-foreground tabular-nums">${(LLM_MODEL_COSTS["gemini-2.5-flash"] ?? 0.012).toFixed(3)}/min</span>
                                </span>
                              </SelectItem>
                              <SelectItem value="gemini-2.5-flash-lite">
                                <span className="flex items-center justify-between gap-3 w-full">
                                  Gemini 2.5 Flash Lite
                                  <span className="text-[10px] text-muted-foreground tabular-nums">${(LLM_MODEL_COSTS["gemini-2.5-flash-lite"] ?? 0.004).toFixed(3)}/min</span>
                                </span>
                              </SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      {planAccess && planAccess.llm_selection !== "full" && (
                        <p className="text-[10px] text-amber-600">Upgrade for more model options</p>
                      )}
                    </div>
                    {!isChat && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5 text-xs font-medium">
                          <AudioLines className="w-3.5 h-3.5 text-muted-foreground" />
                          Voice
                        </Label>
                        <Select value={voice} onValueChange={handleVoiceChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={voicesLoading ? "Loading voices..." : "Select a voice"} />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {voiceOptions.length > 0 ? (
                              voiceOptions.map((v) => {
                                const providerKey = (v.provider || "openai").toLowerCase();
                                const providerCost = VOICE_PROVIDER_COSTS[providerKey] ?? 0;
                                return (
                                  <SelectItem key={v.voice_id} value={v.voice_id}>
                                    <span className="flex items-center gap-2">
                                      {v.voice_name}
                                      <span className="text-[10px] text-muted-foreground">
                                        {v.gender}{v.accent ? ` · ${v.accent}` : ""} · {providerCost > 0 ? `$${providerCost.toFixed(3)}/min` : "included"}
                                      </span>
                                    </span>
                                  </SelectItem>
                                );
                              })
                            ) : (
                              <>
                                <SelectItem value="Hailey">Hailey</SelectItem>
                                <SelectItem value="Grace">Grace</SelectItem>
                                <SelectItem value="Nova">Nova</SelectItem>
                                <SelectItem value="Aria">Aria</SelectItem>
                                <SelectItem value="Luna">Luna</SelectItem>
                                <SelectItem value="Stella">Stella</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                          Use the Test Call button to hear this voice
                        </p>
                      </div>
                    )}
                    {!isChat && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5 text-xs font-medium">
                          <AudioLines className="w-3.5 h-3.5 text-muted-foreground" />
                          Voice Model
                        </Label>
                        <Select value={voiceModel ?? "default"} onValueChange={(v) => setVoiceModel(v === "default" ? null : v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Auto (Default)</SelectItem>
                            <SelectItem value="eleven_turbo_v2">ElevenLabs Turbo v2</SelectItem>
                            <SelectItem value="eleven_flash_v2">ElevenLabs Flash v2</SelectItem>
                            <SelectItem value="eleven_turbo_v2_5">ElevenLabs Turbo v2.5</SelectItem>
                            <SelectItem value="eleven_flash_v2_5">ElevenLabs Flash v2.5</SelectItem>
                            <SelectItem value="eleven_multilingual_v2">ElevenLabs Multilingual v2</SelectItem>
                            <SelectItem value="tts-1">OpenAI TTS-1</SelectItem>
                            <SelectItem value="gpt-4o-mini-tts">GPT-4o Mini TTS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {!isChat && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronDown className="w-3.5 h-3.5" />
                        Voice Speed, Temperature &amp; Volume
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-medium">Voice Speed</Label>
                            <div className="flex items-center gap-3">
                              <Slider
                                value={voiceSpeed}
                                onValueChange={setVoiceSpeed}
                                min={0.5}
                                max={2}
                                step={0.1}
                                className="flex-1"
                              />
                              <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{voiceSpeed[0].toFixed(1)}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">0.5 = slow, 2.0 = fast</p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium">Voice Temperature</Label>
                            <div className="flex items-center gap-3">
                              <Slider
                                value={voiceTemperature}
                                onValueChange={setVoiceTemperature}
                                min={0}
                                max={2}
                                step={0.1}
                                className="flex-1"
                              />
                              <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{voiceTemperature[0].toFixed(1)}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">0 = stable, 2.0 = expressive (11labs only)</p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium">Volume</Label>
                            <div className="flex items-center gap-3">
                              <Slider
                                value={voiceVolume}
                                onValueChange={setVoiceVolume}
                                min={0}
                                max={2}
                                step={0.1}
                                className="flex-1"
                              />
                              <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{voiceVolume[0].toFixed(1)}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">0 = quiet, 2.0 = loud</p>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronDown className="w-3.5 h-3.5" />
                      Advanced LLM Settings
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-xs">High Priority Model</Label>
                            <p className="text-[10px] text-muted-foreground">Dedicated compute for lower, more consistent latency (higher cost)</p>
                          </div>
                          <Switch
                            checked={modelHighPriority}
                            onCheckedChange={setModelHighPriority}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-xs">Strict Tool Call Mode</Label>
                            <p className="text-[10px] text-muted-foreground">Enforce strict parameter validation for function calls</p>
                          </div>
                          <Switch
                            checked={toolCallStrictMode}
                            onCheckedChange={setToolCallStrictMode}
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {planAccess && !planAccess.raw_prompt_editor ? (
                    <UpgradeBanner
                      feature="Raw Prompt Editor"
                      plan="Professional"
                      description="Directly edit the system prompt for full control over agent behavior."
                    />
                  ) : (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">System Prompt</Label>
                    <p className="text-[11px] text-muted-foreground -mt-1">Define how your agent behaves, its personality, and what it knows</p>
                    <Textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={6}
                      className="font-mono text-sm bg-slate-50/50 dark:bg-slate-900/30"
                      placeholder="You are a helpful assistant that..."
                    />
                  </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs font-medium">First Message</Label>
                    <p className="text-[11px] text-muted-foreground -mt-1">
                      {isChat
                        ? "The greeting your agent sends when a chat starts"
                        : "The greeting your agent says when a call starts"}
                    </p>
                    <Textarea
                      value={firstMessage}
                      onChange={(e) => setFirstMessage(e.target.value)}
                      rows={3}
                      className="font-mono text-sm bg-slate-50/50 dark:bg-slate-900/30"
                      placeholder={isChat ? "Hi! How can I help you today?" : "Hi! Thanks for calling. How can I help you today?"}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Edit Prompt Tree CTA */}
              <Link href={`/${clientSlug}/portal/agents/${agentId}/prompt-tree`} className="block mt-4">
                <div className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/10 transition-all hover:shadow-xl hover:shadow-indigo-500/20 hover:scale-[1.01] group cursor-pointer">
                  <div className="relative overflow-hidden rounded-[15px] bg-gradient-to-br from-indigo-50/95 via-blue-50/90 to-cyan-50/95 backdrop-blur-xl p-6">
                    {/* Decorative background elements */}
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-indigo-200/40 to-blue-200/40 blur-2xl" />
                    <div className="absolute -left-4 -bottom-4 h-20 w-20 rounded-full bg-gradient-to-tr from-cyan-200/30 to-blue-200/30 blur-2xl" />
                    <div className="absolute right-12 bottom-2 h-8 w-8 rounded-full bg-indigo-300/20 blur-lg" />

                    <div className="relative flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/30 group-hover:shadow-lg group-hover:shadow-indigo-500/40 transition-all">
                        <GitBranch className="h-7 w-7" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-gray-900 tracking-tight">Edit Prompt Tree</h3>
                        <p className="text-sm text-gray-600 mt-0.5">Design branching conversation flows with states, transitions, and tools</p>
                      </div>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-indigo-500 shadow-sm group-hover:bg-indigo-500 group-hover:text-white group-hover:shadow-md transition-all duration-200">
                        <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>

              <div className="flex gap-3">
                <Button
                  className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>

            {/* Right - Accordion Sections */}
            <div>
              <Accordion type="multiple" className="rounded-lg border">
                {/* Tools */}
                <AccordionItem value="tools">
                  <AccordionTrigger className="px-4">
                    <div>
                      <span className="text-sm font-medium">Tools {functions.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{functions.length}</Badge>}</span>
                      <p className="text-xs text-muted-foreground font-normal">Actions, integrations &amp; tool types</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                      {functions.map((fn) => (
                        <div key={fn.id} className="p-3 bg-accent/30 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {TOOL_TYPE_LABELS[fn.type || "custom"] || fn.type || "custom"}
                            </Badge>
                            <button
                              onClick={() => removeFunction(fn.id)}
                              className="text-muted-foreground hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {/* Common fields: name + description */}
                          <Input
                            value={fn.name}
                            onChange={(e) => updateTool(fn.id, { name: e.target.value })}
                            placeholder="Tool name"
                            className="text-sm font-mono h-8"
                          />
                          <Input
                            value={fn.description}
                            onChange={(e) => updateTool(fn.id, { description: e.target.value })}
                            placeholder="Description"
                            className="text-sm h-8"
                          />

                          {/* --- Agent Swap fields --- */}
                          {fn.type === "agent_swap" && (
                            <div className="space-y-2 pt-1 border-t border-border/50">
                              <div className="space-y-1">
                                <Label className="text-[11px]">Destination Agent ID</Label>
                                <Input
                                  value={fn.agent_id || ""}
                                  onChange={(e) => updateTool(fn.id, { agent_id: e.target.value })}
                                  placeholder="agent_xxxxxxxx"
                                  className="text-sm font-mono h-8"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">Post-Call Analysis</Label>
                                <Select
                                  value={fn.post_call_analysis_setting || "both_agents"}
                                  onValueChange={(v) => updateTool(fn.id, { post_call_analysis_setting: v })}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="both_agents">Both Agents</SelectItem>
                                    <SelectItem value="only_destination_agent">Destination Only</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">Webhook Setting</Label>
                                <Select
                                  value={fn.webhook_setting || "both_agents"}
                                  onValueChange={(v) => updateTool(fn.id, { webhook_setting: v })}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="both_agents">Both Agents</SelectItem>
                                    <SelectItem value="only_destination_agent">Destination Only</SelectItem>
                                    <SelectItem value="only_source_agent">Source Only</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}

                          {/* --- Send SMS fields --- */}
                          {fn.type === "send_sms" && (
                            <div className="space-y-2 pt-1 border-t border-border/50">
                              <div className="space-y-1">
                                <Label className="text-[11px]">SMS Content Type</Label>
                                <Select
                                  value={fn.sms_content?.type || "predefined"}
                                  onValueChange={(v) =>
                                    updateTool(fn.id, {
                                      sms_content: { ...fn.sms_content, type: v },
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="predefined">Predefined</SelectItem>
                                    <SelectItem value="inferred">Inferred (AI-generated)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {fn.sms_content?.type === "inferred" ? (
                                <div className="space-y-1">
                                  <Label className="text-[11px]">SMS Prompt</Label>
                                  <Textarea
                                    value={fn.sms_content?.prompt || ""}
                                    onChange={(e) =>
                                      updateTool(fn.id, {
                                        sms_content: { ...fn.sms_content, prompt: e.target.value },
                                      })
                                    }
                                    placeholder="Describe what SMS to generate..."
                                    rows={2}
                                    className="text-sm"
                                  />
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <Label className="text-[11px]">SMS Content</Label>
                                  <Textarea
                                    value={fn.sms_content?.content || ""}
                                    onChange={(e) =>
                                      updateTool(fn.id, {
                                        sms_content: { ...fn.sms_content, content: e.target.value },
                                      })
                                    }
                                    placeholder="Enter SMS text..."
                                    rows={2}
                                    className="text-sm"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* --- MCP Tool fields --- */}
                          {fn.type === "mcp" && (
                            <div className="space-y-2 pt-1 border-t border-border/50">
                              <div className="space-y-1">
                                <Label className="text-[11px]">MCP Server ID</Label>
                                <Input
                                  value={fn.mcp_id || ""}
                                  onChange={(e) => updateTool(fn.id, { mcp_id: e.target.value })}
                                  placeholder="Optional — links to an MCP server"
                                  className="text-sm font-mono h-8"
                                />
                              </div>
                              <div className="flex items-center gap-4">
                                <label className="flex items-center gap-1.5 text-[11px]">
                                  <Checkbox
                                    checked={fn.speak_during_execution ?? false}
                                    onCheckedChange={(v) => updateTool(fn.id, { speak_during_execution: !!v })}
                                    className="h-3.5 w-3.5"
                                  />
                                  Speak during execution
                                </label>
                                <label className="flex items-center gap-1.5 text-[11px]">
                                  <Checkbox
                                    checked={fn.speak_after_execution ?? false}
                                    onCheckedChange={(v) => updateTool(fn.id, { speak_after_execution: !!v })}
                                    className="h-3.5 w-3.5"
                                  />
                                  Speak after execution
                                </label>
                              </div>
                            </div>
                          )}

                          {/* --- Extract Dynamic Variable fields --- */}
                          {fn.type === "extract_dynamic_variable" && (
                            <div className="space-y-2 pt-1 border-t border-border/50">
                              <Label className="text-[11px]">Variables</Label>
                              {(fn.variables || []).map((v, vi) => (
                                <div key={vi} className="flex items-start gap-1.5 p-2 bg-background/50 rounded">
                                  <div className="flex-1 grid grid-cols-[1fr_1fr_auto] gap-1.5">
                                    <Input
                                      value={v.name}
                                      onChange={(e) => {
                                        const vars = [...(fn.variables || [])];
                                        vars[vi] = { ...vars[vi], name: e.target.value };
                                        updateTool(fn.id, { variables: vars });
                                      }}
                                      placeholder="Variable name"
                                      className="text-xs font-mono h-7"
                                    />
                                    <Input
                                      value={v.description}
                                      onChange={(e) => {
                                        const vars = [...(fn.variables || [])];
                                        vars[vi] = { ...vars[vi], description: e.target.value };
                                        updateTool(fn.id, { variables: vars });
                                      }}
                                      placeholder="Description"
                                      className="text-xs h-7"
                                    />
                                    <Select
                                      value={v.type || "string"}
                                      onValueChange={(val) => {
                                        const vars = [...(fn.variables || [])];
                                        vars[vi] = { ...vars[vi], type: val };
                                        updateTool(fn.id, { variables: vars });
                                      }}
                                    >
                                      <SelectTrigger className="h-7 text-[10px] w-24">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="string">String</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                        <SelectItem value="boolean">Boolean</SelectItem>
                                        <SelectItem value="enum">Enum</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const vars = (fn.variables || []).filter((_, i) => i !== vi);
                                      updateTool(fn.id, { variables: vars });
                                    }}
                                    className="text-muted-foreground hover:text-red-600 mt-1"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                              {fn.type === "extract_dynamic_variable" && (fn.variables || []).some((v) => v.type === "enum") && (
                                <p className="text-[10px] text-muted-foreground">
                                  For enum variables, set choices in the description as comma-separated values.
                                </p>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const vars = [...(fn.variables || []), { name: "", description: "", type: "string" }];
                                  updateTool(fn.id, { variables: vars });
                                }}
                                className="gap-1 h-7 text-xs"
                              >
                                <Plus className="h-3 w-3" />
                                Add Variable
                              </Button>
                            </div>
                          )}

                          {/* --- Transfer Call fields --- */}
                          {fn.type === "transfer_call" && (
                            <div className="space-y-2 pt-1 border-t border-border/50">
                              {/* Destination */}
                              <div className="space-y-1">
                                <Label className="text-[11px]">Destination Type</Label>
                                <Select
                                  value={fn.transfer_destination?.type || "predefined"}
                                  onValueChange={(v) =>
                                    updateTool(fn.id, {
                                      transfer_destination: { ...fn.transfer_destination, type: v },
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="predefined">Predefined Number</SelectItem>
                                    <SelectItem value="inferred">AI-Inferred</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {fn.transfer_destination?.type === "inferred" ? (
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Destination Prompt</Label>
                                  <Textarea
                                    value={fn.transfer_destination?.prompt || ""}
                                    onChange={(e) =>
                                      updateTool(fn.id, {
                                        transfer_destination: { ...fn.transfer_destination, prompt: e.target.value },
                                      })
                                    }
                                    placeholder="Describe how the AI should determine the transfer number..."
                                    rows={2}
                                    className="text-sm"
                                  />
                                </div>
                              ) : (
                                <div className="grid grid-cols-[1fr_auto] gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[11px]">Phone Number</Label>
                                    <Input
                                      value={fn.transfer_destination?.number || ""}
                                      onChange={(e) =>
                                        updateTool(fn.id, {
                                          transfer_destination: { ...fn.transfer_destination, number: e.target.value },
                                        })
                                      }
                                      placeholder="+1234567890"
                                      className="text-sm font-mono h-8"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[11px]">Extension</Label>
                                    <Input
                                      value={fn.transfer_destination?.extension || ""}
                                      onChange={(e) =>
                                        updateTool(fn.id, {
                                          transfer_destination: { ...fn.transfer_destination, extension: e.target.value },
                                        })
                                      }
                                      placeholder="Opt."
                                      className="text-sm font-mono h-8 w-20"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Transfer Option */}
                              <div className="space-y-1">
                                <Label className="text-[11px]">Transfer Mode</Label>
                                <Select
                                  value={fn.transfer_option?.type || "cold_transfer"}
                                  onValueChange={(v) =>
                                    updateTool(fn.id, {
                                      transfer_option: { ...fn.transfer_option, type: v },
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="cold_transfer">Cold Transfer</SelectItem>
                                    <SelectItem value="warm_transfer">Warm Transfer</SelectItem>
                                    <SelectItem value="agentic_warm_transfer">Agentic Warm Transfer</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Warm / Agentic options */}
                              {(fn.transfer_option?.type === "warm_transfer" || fn.transfer_option?.type === "agentic_warm_transfer") && (
                                <div className="space-y-2 pl-3 border-l-2 border-primary/20 ml-1">
                                  <div className="space-y-1">
                                    <Label className="text-[11px]">Hold Music</Label>
                                    <Select
                                      value={fn.transfer_option?.on_hold_music || "none"}
                                      onValueChange={(v) =>
                                        updateTool(fn.id, {
                                          transfer_option: { ...fn.transfer_option, on_hold_music: v },
                                        })
                                      }
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        <SelectItem value="relaxing_sound">Relaxing Sound</SelectItem>
                                        <SelectItem value="uplifting_beats">Uplifting Beats</SelectItem>
                                        <SelectItem value="ringtone">Ringtone</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {fn.transfer_option?.type === "warm_transfer" && (
                                    <>
                                      <div className="space-y-1">
                                        <Label className="text-[11px]">Agent Detection Timeout (ms)</Label>
                                        <Input
                                          type="number"
                                          value={fn.transfer_option?.agent_detection_timeout_ms ?? 30000}
                                          onChange={(e) =>
                                            updateTool(fn.id, {
                                              transfer_option: { ...fn.transfer_option, agent_detection_timeout_ms: parseInt(e.target.value) || 30000 },
                                            })
                                          }
                                          className="text-xs h-8 w-32"
                                        />
                                      </div>
                                      <div className="flex flex-col gap-1.5">
                                        <label className="flex items-center gap-1.5 text-[11px]">
                                          <Checkbox
                                            checked={fn.transfer_option?.opt_out_human_detection ?? false}
                                            onCheckedChange={(v) =>
                                              updateTool(fn.id, {
                                                transfer_option: { ...fn.transfer_option, opt_out_human_detection: !!v },
                                              })
                                            }
                                            className="h-3.5 w-3.5"
                                          />
                                          Skip human detection
                                        </label>
                                        <label className="flex items-center gap-1.5 text-[11px]">
                                          <Checkbox
                                            checked={fn.transfer_option?.opt_out_initial_message ?? false}
                                            onCheckedChange={(v) =>
                                              updateTool(fn.id, {
                                                transfer_option: { ...fn.transfer_option, opt_out_initial_message: !!v },
                                              })
                                            }
                                            className="h-3.5 w-3.5"
                                          />
                                          Skip initial message to transferee
                                        </label>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Common transfer options */}
                              <label className="flex items-center gap-1.5 text-[11px]">
                                <Checkbox
                                  checked={fn.transfer_option?.show_transferee_as_caller ?? false}
                                  onCheckedChange={(v) =>
                                    updateTool(fn.id, {
                                      transfer_option: { ...fn.transfer_option, show_transferee_as_caller: !!v },
                                    })
                                  }
                                  className="h-3.5 w-3.5"
                                />
                                Show original caller ID to transferee
                              </label>
                              <label className="flex items-center gap-1.5 text-[11px]">
                                <Checkbox
                                  checked={fn.ignore_e164_validation ?? false}
                                  onCheckedChange={(v) => updateTool(fn.id, { ignore_e164_validation: !!v })}
                                  className="h-3.5 w-3.5"
                                />
                                Skip E.164 phone number validation
                              </label>
                            </div>
                          )}

                          {/* --- Custom Tool fields --- */}
                          {fn.type === "custom" && (
                            <div className="space-y-2 pt-1 border-t border-border/50">
                              <div className="grid grid-cols-[1fr_auto] gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Webhook URL</Label>
                                  <Input
                                    value={(fn.url as string) || ""}
                                    onChange={(e) => updateTool(fn.id, { url: e.target.value })}
                                    placeholder="https://your-server.com/tool"
                                    className="text-xs font-mono h-8"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Method</Label>
                                  <Select
                                    value={(fn.method as string) || "POST"}
                                    onValueChange={(v) => updateTool(fn.id, { method: v })}
                                  >
                                    <SelectTrigger className="h-8 text-xs w-24">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="GET">GET</SelectItem>
                                      <SelectItem value="POST">POST</SelectItem>
                                      <SelectItem value="PUT">PUT</SelectItem>
                                      <SelectItem value="PATCH">PATCH</SelectItem>
                                      <SelectItem value="DELETE">DELETE</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">Execution Message</Label>
                                <Input
                                  value={(fn.execution_message_description as string) || ""}
                                  onChange={(e) => updateTool(fn.id, { execution_message_description: e.target.value })}
                                  placeholder="What the agent says while executing (e.g. 'Looking that up for you...')"
                                  className="text-xs h-8"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">Timeout (ms)</Label>
                                <Input
                                  type="number"
                                  value={fn.timeout_ms ?? 120000}
                                  onChange={(e) => updateTool(fn.id, { timeout_ms: parseInt(e.target.value) || 120000 })}
                                  className="text-xs h-8 w-32"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">Headers (JSON)</Label>
                                <Textarea
                                  value={fn.headers ? JSON.stringify(fn.headers, null, 2) : "{}"}
                                  onChange={(e) => {
                                    try {
                                      const parsed = JSON.parse(e.target.value);
                                      updateTool(fn.id, { headers: parsed });
                                    } catch {
                                      // allow invalid JSON while typing
                                    }
                                  }}
                                  placeholder='{"Authorization": "Bearer ..."}'
                                  rows={2}
                                  className="text-xs font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">Parameters Schema (JSON)</Label>
                                <Textarea
                                  value={fn.parameters ? JSON.stringify(fn.parameters, null, 2) : '{"properties": {}, "type": "object"}'}
                                  onChange={(e) => {
                                    try {
                                      const parsed = JSON.parse(e.target.value);
                                      updateTool(fn.id, { parameters: parsed });
                                    } catch {
                                      // allow invalid JSON while typing
                                    }
                                  }}
                                  placeholder='{"properties": {"query": {"type": "string", "description": "Search query"}}, "type": "object", "required": ["query"]}'
                                  rows={3}
                                  className="text-xs font-mono"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  JSON Schema defining the parameters the LLM extracts from conversation and sends to your URL.
                                </p>
                              </div>
                              <div className="flex items-center gap-4">
                                <label className="flex items-center gap-1.5 text-[11px]">
                                  <Checkbox
                                    checked={fn.speak_during_execution ?? false}
                                    onCheckedChange={(v) => updateTool(fn.id, { speak_during_execution: !!v })}
                                    className="h-3.5 w-3.5"
                                  />
                                  Speak during execution
                                </label>
                                <label className="flex items-center gap-1.5 text-[11px]">
                                  <Checkbox
                                    checked={fn.speak_after_execution ?? true}
                                    onCheckedChange={(v) => updateTool(fn.id, { speak_after_execution: !!v })}
                                    className="h-3.5 w-3.5"
                                  />
                                  Speak after execution
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Add Tool dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1">
                            <Plus className="h-3.5 w-3.5" />
                            Add
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => addFunction("end_call")}>End Call</DropdownMenuItem>
                          {!isChat && <DropdownMenuItem onClick={() => addFunction("transfer_call")}>Call Transfer</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => addFunction("agent_swap")}>Agent Transfer</DropdownMenuItem>
                          {!isChat && <DropdownMenuItem onClick={() => addFunction("check_availability_cal")}>Check Calendar Availability</DropdownMenuItem>}
                          {!isChat && <DropdownMenuItem onClick={() => addFunction("book_appointment_cal")}>Book on Calendar</DropdownMenuItem>}
                          {!isChat && <DropdownMenuItem onClick={() => addFunction("press_digit")}>Press Digit</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => addFunction("send_sms")}>Send SMS</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => addFunction("extract_dynamic_variable")}>Extract Dynamic Variable</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => addFunction("custom")}>Custom Function</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                  </AccordionContent>
                </AccordionItem>

                {/* Speech Settings - voice agents only */}
                {!isChat && planAccess && !planAccess.speech_settings_full && (
                  <div className="px-4 py-3">
                    <UpgradeBanner
                      feature="Advanced Speech Settings"
                      plan="Professional"
                      description="Unlock responsiveness tuning, background sounds, and backchannel settings."
                    />
                  </div>
                )}
                {!isChat && (!planAccess || planAccess.speech_settings_full) && (
                <AccordionItem value="speech">
                  <AccordionTrigger className="px-4">
                    <div>
                      <span className="text-sm font-medium">Speech Settings</span>
                      <p className="text-xs text-muted-foreground font-normal">Voice behavior &amp; background audio</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Responsiveness</Label>
                            <span className="text-xs text-muted-foreground font-mono">
                              {responsiveness[0].toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={responsiveness}
                            onValueChange={setResponsiveness}
                            min={0}
                            max={1}
                            step={0.01}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Interruption Sensitivity</Label>
                            <span className="text-xs text-muted-foreground font-mono">
                              {interruptionSensitivity[0].toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={interruptionSensitivity}
                            onValueChange={setInterruptionSensitivity}
                            min={0}
                            max={1}
                            step={0.01}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Background Sound</Label>
                          <Select
                            value={backgroundSound}
                            onValueChange={setBackgroundSound}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="off">Off</SelectItem>
                              <SelectItem value="coffee-shop">Coffee Shop</SelectItem>
                              <SelectItem value="convention-hall">Convention Hall</SelectItem>
                              <SelectItem value="summer-outdoor">Summer Outdoor</SelectItem>
                              <SelectItem value="mountain-outdoor">Mountain Outdoor</SelectItem>
                              <SelectItem value="static-noise">Static Noise</SelectItem>
                              <SelectItem value="call-center">Call Center</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {backgroundSound !== "off" && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Background Volume</Label>
                              <span className="text-xs text-muted-foreground font-mono">
                                {backgroundVolume[0].toFixed(2)}
                              </span>
                            </div>
                            <Slider
                              value={backgroundVolume}
                              onValueChange={setBackgroundVolume}
                              min={0}
                              max={1}
                              step={0.01}
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Backchanneling</Label>
                          <Switch
                            checked={backchanneling}
                            onCheckedChange={setBackchanneling}
                          />
                        </div>
                        {backchanneling && (
                          <>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Backchannel Frequency</Label>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {backchannelFrequency[0].toFixed(2)}
                                </span>
                              </div>
                              <Slider
                                value={backchannelFrequency}
                                onValueChange={setBackchannelFrequency}
                                min={0}
                                max={1}
                                step={0.01}
                              />
                              <p className="text-[10px] text-muted-foreground">0 = rare, 1 = frequent</p>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Backchannel Words</Label>
                              <Input
                                value={backchannelWords}
                                onChange={(e) => setBackchannelWords(e.target.value)}
                                placeholder="yeah, uh-huh, right, I see"
                                className="h-8 text-xs"
                              />
                              <p className="text-[10px] text-muted-foreground">Comma-separated words the agent uses as interjections</p>
                            </div>
                          </>
                        )}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-xs">Speech Normalization</Label>
                            <p className="text-[10px] text-muted-foreground">Convert numbers, dates, and currency to spoken form</p>
                          </div>
                          <Switch
                            checked={speechNormalization}
                            onCheckedChange={setSpeechNormalization}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Reminder Settings</Label>
                          <p className="text-[10px] text-muted-foreground">When the user is silent, the agent sends a reminder</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Interval (seconds)</Label>
                              <Input
                                type="number"
                                value={reminderFrequency}
                                onChange={(e) => setReminderFrequency(e.target.value)}
                                min="1"
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Max count (0 = disabled)</Label>
                              <Input
                                type="number"
                                value={reminderMaxCount}
                                onChange={(e) => setReminderMaxCount(e.target.value)}
                                min="0"
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-xs">Pronunciation Dictionary</Label>
                              <p className="text-[10px] text-muted-foreground">Custom pronunciation rules (English + ElevenLabs only)</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                setPronunciationEntries((prev) => [
                                  ...prev,
                                  { id: Date.now().toString(), word: "", phoneme: "", alphabet: "ipa" },
                                ])
                              }
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add
                            </Button>
                          </div>
                          {pronunciationEntries.map((entry) => (
                            <div key={entry.id} className="flex items-center gap-2">
                              <Input
                                value={entry.word}
                                onChange={(e) =>
                                  setPronunciationEntries((prev) =>
                                    prev.map((p) =>
                                      p.id === entry.id ? { ...p, word: e.target.value } : p
                                    )
                                  )
                                }
                                placeholder="Word"
                                className="h-8 text-xs flex-1"
                              />
                              <Input
                                value={entry.phoneme}
                                onChange={(e) =>
                                  setPronunciationEntries((prev) =>
                                    prev.map((p) =>
                                      p.id === entry.id ? { ...p, phoneme: e.target.value } : p
                                    )
                                  )
                                }
                                placeholder="Phoneme (e.g. ˈɪnˌveɪriə)"
                                className="h-8 text-xs flex-1"
                              />
                              <Select
                                value={entry.alphabet}
                                onValueChange={(v) =>
                                  setPronunciationEntries((prev) =>
                                    prev.map((p) =>
                                      p.id === entry.id ? { ...p, alphabet: v } : p
                                    )
                                  )
                                }
                              >
                                <SelectTrigger className="h-8 text-xs w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ipa">IPA</SelectItem>
                                  <SelectItem value="cmu">CMU</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  setPronunciationEntries((prev) =>
                                    prev.filter((p) => p.id !== entry.id)
                                  )
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                  </AccordionContent>
                </AccordionItem>
                )}

                {/* Realtime Transcription - voice agents only */}
                {!isChat && (
                <AccordionItem value="transcription">
                  <AccordionTrigger className="px-4">
                    <div>
                      <span className="text-sm font-medium">Transcription</span>
                      <p className="text-xs text-muted-foreground font-normal">Live speech-to-text settings</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Noise Reduction</Label>
                      <RadioGroup value={denoisingMode} onValueChange={setDenoisingMode} className="gap-2">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <RadioGroupItem value="no-denoise" />
                          Off
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <RadioGroupItem value="noise-cancellation" />
                          Noise Cancellation — included
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <RadioGroupItem value="noise-and-background-speech-cancellation" />
                          Noise + Background Speech — +${ADDON_COSTS.advancedDenoising.toFixed(3)}/min
                        </label>
                      </RadioGroup>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Transcription Mode</Label>
                      <RadioGroup value={transcriptionMode} onValueChange={(v) => {
                        setTranscriptionMode(v);
                        if (v !== "custom") setCustomSttConfig(null);
                      }} className="gap-2">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <RadioGroupItem value="fast" />
                          Fast
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <RadioGroupItem value="accurate" />
                          Accurate
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <RadioGroupItem value="custom" />
                          Custom
                        </label>
                      </RadioGroup>
                    </div>
                    {transcriptionMode === "custom" && (
                      <div className="space-y-2 pl-3 border-l-2 border-primary/20 ml-1">
                        <div className="space-y-1">
                          <Label className="text-xs">STT Provider</Label>
                          <Select
                            value={customSttConfig?.provider || "deepgram"}
                            onValueChange={(v) => setCustomSttConfig((prev) => ({ ...prev, provider: v }))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="deepgram">Deepgram</SelectItem>
                              <SelectItem value="assembly_ai">Assembly AI</SelectItem>
                              <SelectItem value="google">Google</SelectItem>
                              <SelectItem value="whisper">Whisper</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Endpointing (ms)</Label>
                          <Input
                            type="number"
                            value={customSttConfig?.endpointing_ms ?? 500}
                            onChange={(e) => setCustomSttConfig((prev) => ({ ...prev, endpointing_ms: parseInt(e.target.value) || 500 }))}
                            className="h-8 text-xs w-32"
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs">Vocabulary</Label>
                      <RadioGroup value={vocabulary} onValueChange={setVocabulary} className="gap-2">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <RadioGroupItem value="general" />
                          General
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <RadioGroupItem value="medical" />
                          Medical
                        </label>
                      </RadioGroup>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Boosted Keywords</Label>
                      <Input
                        value={boostedKeywords}
                        onChange={(e) => setBoostedKeywords(e.target.value)}
                        placeholder="Priority words (comma separated)"
                        className="text-sm h-8"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
                )}

                {/* Chat Settings - chat/SMS agents only */}
                {isChat && (
                <AccordionItem value="chat-settings">
                  <AccordionTrigger className="px-4">
                    <div>
                      <span className="text-sm font-medium">Chat Settings</span>
                      <p className="text-xs text-muted-foreground font-normal">Timeout &amp; auto-close behavior</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Inactivity Timeout (minutes)</Label>
                      <Input
                        type="number"
                        value={chatSilenceTimeout}
                        onChange={(e) => setChatSilenceTimeout(e.target.value)}
                        min="6"
                        max="4320"
                        className="h-8 text-sm w-32"
                      />
                      <p className="text-[10px] text-muted-foreground">End chat after this many minutes of silence (min: 6, max: 4320 / 72 hours)</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Auto-Close Message</Label>
                      <Textarea
                        value={autoCloseMessage}
                        onChange={(e) => setAutoCloseMessage(e.target.value)}
                        rows={2}
                        className="text-xs resize-y"
                        placeholder="This chat has been closed due to inactivity."
                      />
                      <p className="text-[10px] text-muted-foreground">Message shown when the chat auto-closes. Leave empty for no message.</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                )}

                {/* Call Settings - voice agents only */}
                {!isChat && (
                <AccordionItem value="call-settings">
                  <AccordionTrigger className="px-4">
                    <div>
                      <span className="text-sm font-medium">Call Settings</span>
                      <p className="text-xs text-muted-foreground font-normal">Duration, timeouts &amp; detection</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Voicemail Detection</Label>
                          <Switch
                            checked={voicemailDetection}
                            onCheckedChange={setVoicemailDetection}
                          />
                        </div>
                        {voicemailDetection && (
                          <div className="space-y-2 pl-1 border-l-2 border-primary/20 ml-1">
                            <div className="space-y-1.5 pl-3">
                              <Label className="text-xs">Voicemail Action</Label>
                              <Select value={voicemailAction} onValueChange={setVoicemailAction}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hangup">Hang Up</SelectItem>
                                  <SelectItem value="prompt">Leave Message (AI Prompt)</SelectItem>
                                  <SelectItem value="static_text">Leave Message (Static Text)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {voicemailAction !== "hangup" && (
                              <div className="space-y-1.5 pl-3">
                                <Label className="text-xs">
                                  {voicemailAction === "prompt" ? "Prompt for AI" : "Message Text"}
                                </Label>
                                <Textarea
                                  value={voicemailText}
                                  onChange={(e) => setVoicemailText(e.target.value)}
                                  rows={2}
                                  className="text-xs resize-y"
                                  placeholder={
                                    voicemailAction === "prompt"
                                      ? "Leave a professional voicemail mentioning..."
                                      : "Hi, this is a call from Acme Corp..."
                                  }
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  {voicemailAction === "prompt"
                                    ? "AI will generate a voicemail message from this prompt"
                                    : "This exact text will be spoken as the voicemail"}
                                </p>
                              </div>
                            )}
                            <div className="space-y-1.5 pl-3">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Detection Timeout</Label>
                                <span className="text-xs text-muted-foreground font-mono">{voicemailDetectionTimeout} s</span>
                              </div>
                              <Slider
                                value={[parseFloat(voicemailDetectionTimeout) || 30]}
                                onValueChange={([v]) => setVoicemailDetectionTimeout(String(v))}
                                min={5}
                                max={180}
                                step={1}
                              />
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-xs">IVR Detection</Label>
                            <p className="text-[10px] text-muted-foreground">Detect IVR systems in the first 3 minutes of a call</p>
                          </div>
                          <Switch
                            checked={ivrEnabled}
                            onCheckedChange={setIvrEnabled}
                          />
                        </div>
                        {ivrEnabled && (
                          <div className="space-y-1.5 pl-3 border-l-2 border-primary/20 ml-1">
                            <Label className="text-xs">Action When IVR Detected</Label>
                            <Select value={ivrAction} onValueChange={(v) => setIvrAction(v as "hangup")}>
                              <SelectTrigger className="h-8 text-xs w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hangup">Hang Up</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground">Action to take when an IVR menu is detected.</p>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Keypad Input (DTMF)</Label>
                          <Switch
                            checked={keypadInput}
                            onCheckedChange={setKeypadInput}
                          />
                        </div>
                        {keypadInput && (
                          <div className="space-y-2 pl-1 border-l-2 border-primary/20 ml-1">
                            <div className="grid grid-cols-3 gap-2 pl-3">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Digit Limit</Label>
                                <Input
                                  type="number"
                                  value={dtmfDigitLimit}
                                  onChange={(e) => setDtmfDigitLimit(e.target.value)}
                                  placeholder="None"
                                  min="1"
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">End Key</Label>
                                <Select value={dtmfTerminationKey || "none"} onValueChange={(v) => setDtmfTerminationKey(v === "none" ? "" : v)}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="#">#</SelectItem>
                                    <SelectItem value="*">*</SelectItem>
                                    {[...Array(10)].map((_, i) => (
                                      <SelectItem key={i} value={String(i)}>{i}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Timeout (s)</Label>
                                <Input
                                  type="number"
                                  value={dtmfTimeout}
                                  onChange={(e) => setDtmfTimeout(e.target.value)}
                                  min="1"
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Silence Timeout</Label>
                        <span className="text-xs text-muted-foreground font-mono">{silenceTimeout} s</span>
                      </div>
                      <Slider
                        value={[parseFloat(silenceTimeout) || 30]}
                        onValueChange={([v]) => setSilenceTimeout(String(v))}
                        min={10}
                        max={600}
                        step={5}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Max Call Duration</Label>
                        <span className="text-xs text-muted-foreground font-mono">
                          {parseFloat(maxDuration) >= 3600
                            ? `${(parseFloat(maxDuration) / 3600).toFixed(2)} h`
                            : `${maxDuration} s`}
                        </span>
                      </div>
                      <Slider
                        value={[parseFloat(maxDuration) || 3600]}
                        onValueChange={([v]) => setMaxDuration(String(v))}
                        min={60}
                        max={7200}
                        step={60}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Begin Message Delay</Label>
                        <span className="text-xs text-muted-foreground font-mono">{pauseBeforeSpeaking} s</span>
                      </div>
                      <Slider
                        value={[parseFloat(pauseBeforeSpeaking) || 0.4]}
                        onValueChange={([v]) => setPauseBeforeSpeaking(String(Math.round(v * 10) / 10))}
                        min={0}
                        max={5}
                        step={0.1}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Ring Duration</Label>
                        <span className="text-xs text-muted-foreground font-mono">{ringDuration} s</span>
                      </div>
                      <Slider
                        value={[parseFloat(ringDuration) || 15]}
                        onValueChange={([v]) => setRingDuration(String(v))}
                        min={5}
                        max={90}
                        step={1}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

                {/* Knowledge Base Config */}
                <AccordionItem value="knowledge-base">
                  <AccordionTrigger className="px-4">
                    <div>
                      <span className="text-sm font-medium">Knowledge Base {knowledgeBaseIds.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{knowledgeBaseIds.length} linked</Badge>}</span>
                      <p className="text-xs text-muted-foreground font-normal">RAG retrieval settings</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                    {knowledgeBaseIds.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Linked Knowledge Bases</Label>
                        <div className="space-y-1">
                          {knowledgeBaseIds.map((kbId) => (
                            <div key={kbId} className="flex items-center justify-between p-1.5 bg-accent/30 rounded text-[11px]">
                              <span className="font-mono truncate flex-1">{kbId}</span>
                              <button
                                onClick={() => setKnowledgeBaseIds((prev) => prev.filter((id) => id !== kbId))}
                                className="text-muted-foreground hover:text-red-600 ml-2"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Manage knowledge base sources (documents, text, URLs) from the Knowledge Base tab.
                    </p>
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                        <Settings2 className="w-3 h-3" />
                        Advance Setting
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-3 space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Top K (chunks to retrieve)</Label>
                            <span className="text-xs text-muted-foreground font-mono">{kbTopK}</span>
                          </div>
                          <Slider
                            value={[parseInt(kbTopK) || 5]}
                            onValueChange={([v]) => setKbTopK(String(v))}
                            min={1}
                            max={20}
                            step={1}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Filter Score (similarity threshold)</Label>
                            <span className="text-xs text-muted-foreground font-mono">{parseFloat(kbFilterScore).toFixed(2)}</span>
                          </div>
                          <Slider
                            value={[parseFloat(kbFilterScore) || 0.7]}
                            onValueChange={([v]) => setKbFilterScore(String(v))}
                            min={0}
                            max={1}
                            step={0.05}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </AccordionContent>
                </AccordionItem>

                {/* Post Call/Chat Analysis */}
                <AccordionItem value="post-call">
                  <AccordionTrigger className="px-4">
                    <div>
                      <span className="text-sm font-medium">{isChat ? "Post Chat Analysis" : "Post Call Analysis"}</span>
                      <p className="text-xs text-muted-foreground font-normal">{isChat ? "AI-powered chat insights" : "AI-powered call insights"}</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Analysis Model</Label>
                      <Select
                        value={postCallModel}
                        onValueChange={setPostCallModel}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
                          <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                          <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          <SelectItem value="gpt-5">GPT-5</SelectItem>
                          <SelectItem value="gpt-5-mini">GPT-5 Mini</SelectItem>
                          <SelectItem value="claude-4.5-sonnet">Claude 4.5 Sonnet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Built-in prompt fields */}
                    <div className="space-y-2">
                      <Label className="text-xs">Call Summary Prompt</Label>
                      <Textarea
                        value={analysisSummaryPrompt}
                        onChange={(e) => setAnalysisSummaryPrompt(e.target.value)}
                        rows={2}
                        placeholder="Summarize this conversation..."
                        className="text-xs resize-y"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Call Successful Prompt</Label>
                      <Textarea
                        value={analysisSuccessfulPrompt}
                        onChange={(e) => setAnalysisSuccessfulPrompt(e.target.value)}
                        rows={2}
                        placeholder="Evaluate whether this call was successful..."
                        className="text-xs resize-y"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">User Sentiment Prompt</Label>
                      <Textarea
                        value={analysisSentimentPrompt}
                        onChange={(e) => setAnalysisSentimentPrompt(e.target.value)}
                        rows={2}
                        placeholder="Analyze the user's sentiment..."
                        className="text-xs resize-y"
                      />
                    </div>

                    {/* Structured extraction items */}
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Data Extraction Items</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => setPostCallItems((prev) => [...prev, { name: "", description: "", type: "string" }])}
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </Button>
                      </div>
                      {postCallItems.map((item, idx) => (
                        <div key={idx} className="p-2.5 bg-accent/30 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <Input
                              value={item.name}
                              onChange={(e) => {
                                const items = [...postCallItems];
                                items[idx] = { ...items[idx], name: e.target.value };
                                setPostCallItems(items);
                              }}
                              placeholder="Field name"
                              className="text-xs font-mono h-7 flex-1 mr-2"
                            />
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setEditingPostCallIdx(editingPostCallIdx === idx ? null : idx)}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => setPostCallItems((prev) => prev.filter((_, i) => i !== idx))}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          {editingPostCallIdx === idx && (
                            <div className="space-y-2 pl-2 border-l-2 border-primary/20">
                              <Textarea
                                value={item.description}
                                onChange={(e) => {
                                  const items = [...postCallItems];
                                  items[idx] = { ...items[idx], description: e.target.value };
                                  setPostCallItems(items);
                                }}
                                placeholder="Description of what to extract"
                                rows={2}
                                className="text-xs"
                              />
                              <Select
                                value={item.type}
                                onValueChange={(v) => {
                                  const items = [...postCallItems];
                                  items[idx] = { ...items[idx], type: v as PostCallItem["type"] };
                                  setPostCallItems(items);
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="string">String</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="boolean">Boolean</SelectItem>
                                  <SelectItem value="enum">Enum</SelectItem>
                                </SelectContent>
                              </Select>
                              {item.type === "enum" && (
                                <Input
                                  value={(item.choices || []).join(", ")}
                                  onChange={(e) => {
                                    const items = [...postCallItems];
                                    items[idx] = { ...items[idx], choices: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) };
                                    setPostCallItems(items);
                                  }}
                                  placeholder="Choices (comma separated)"
                                  className="text-xs h-7"
                                />
                              )}
                              {item.type === "string" && (
                                <Input
                                  value={(item.examples || []).join(", ")}
                                  onChange={(e) => {
                                    const items = [...postCallItems];
                                    items[idx] = { ...items[idx], examples: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) };
                                    setPostCallItems(items);
                                  }}
                                  placeholder="Examples (comma separated)"
                                  className="text-xs h-7"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Security & Privacy */}
                <AccordionItem value="security">
                  <AccordionTrigger className="px-4">
                    <div>
                      <span className="text-sm font-medium">Security &amp; Privacy</span>
                      <p className="text-xs text-muted-foreground font-normal">Data protection &amp; fallbacks</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Data Storage</Label>
                      <RadioGroup value={dataStorage} onValueChange={setDataStorage} className="gap-2">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <RadioGroupItem value="everything" />
                          Everything
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <RadioGroupItem value="everything_except_pii" />
                          Everything Except PII
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <RadioGroupItem value="basic_attributes_only" />
                          Basic Attributes Only
                        </label>
                      </RadioGroup>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Secure URLs</Label>
                      <Switch
                        checked={secureUrls}
                        onCheckedChange={setSecureUrls}
                      />
                    </div>
                    {secureUrls && (
                      <div className="space-y-1.5 pl-3 border-l-2 border-primary/20 ml-1">
                        <Label className="text-xs">URL Expiration (hours)</Label>
                        <Input
                          type="number"
                          value={signedUrlExpiration}
                          onChange={(e) => setSignedUrlExpiration(e.target.value)}
                          min="1"
                          max="168"
                          className="h-8 text-xs w-32"
                        />
                        <p className="text-[10px] text-muted-foreground">Default: 24 hours. Max: 168 hours (7 days).</p>
                      </div>
                    )}
                    {!isChat && (
                      <div className="space-y-2">
                        <Label className="text-xs">Fallback Voice IDs</Label>
                        <Input
                          value={fallbackVoiceIds}
                          onChange={(e) => setFallbackVoiceIds(e.target.value)}
                          placeholder="Comma-separated voice IDs"
                          className="text-sm h-8"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs">Default Dynamic Variables</Label>
                      <Textarea
                        value={defaultDynamicVars}
                        onChange={(e) => setDefaultDynamicVars(e.target.value)}
                        rows={3}
                        placeholder='e.g.: {"company": "Acme"}'
                        className="font-mono text-xs resize-y"
                      />
                    </div>
                    <PiiRedactionSettings agentId={agentId} embedded />

                    {/* Guardrails */}
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs">Safety Guardrails</Label>
                          <p className="text-[10px] text-muted-foreground">Block harmful input/output topics</p>
                        </div>
                        <Dialog open={guardrailDialogOpen} onOpenChange={setGuardrailDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              {(guardrailOutputTopics.length + guardrailInputTopics.length) > 0
                                ? `${guardrailOutputTopics.length + guardrailInputTopics.length} active`
                                : "Set Up"}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Safety Guardrails</DialogTitle>
                              <DialogDescription>Select topics to block in agent output and input.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                              <div className="space-y-2">
                                <Label className="text-xs font-medium">Output Topics</Label>
                                {GUARDRAIL_OUTPUT_TOPICS.map((topic) => (
                                  <label key={topic.value} className="flex items-center gap-2 text-xs cursor-pointer">
                                    <Checkbox
                                      checked={guardrailOutputTopics.includes(topic.value)}
                                      onCheckedChange={(checked) => {
                                        setGuardrailOutputTopics((prev) =>
                                          checked ? [...prev, topic.value] : prev.filter((t) => t !== topic.value)
                                        );
                                      }}
                                      className="h-3.5 w-3.5"
                                    />
                                    {topic.label}
                                  </label>
                                ))}
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs font-medium">Input Topics</Label>
                                {GUARDRAIL_INPUT_TOPICS.map((topic) => (
                                  <label key={topic.value} className="flex items-center gap-2 text-xs cursor-pointer">
                                    <Checkbox
                                      checked={guardrailInputTopics.includes(topic.value)}
                                      onCheckedChange={(checked) => {
                                        setGuardrailInputTopics((prev) =>
                                          checked ? [...prev, topic.value] : prev.filter((t) => t !== topic.value)
                                        );
                                      }}
                                      className="h-3.5 w-3.5"
                                    />
                                    {topic.label}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={() => setGuardrailDialogOpen(false)}>Done</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Webhook */}
                <AccordionItem value="webhook">
                  <AccordionTrigger className="px-4">
                    <div>
                      <span className="text-sm font-medium">Webhook</span>
                      <p className="text-xs text-muted-foreground font-normal">Event notifications URL</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Webhook URL</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                          placeholder="https://your-server.com/webhook"
                          className="h-8 text-xs font-mono flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs shrink-0"
                          onClick={testWebhook}
                          disabled={webhookTesting || !webhookUrl.trim()}
                        >
                          {webhookTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Test"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Leave empty to use account-level webhook.</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Timeout</Label>
                        <span className="text-xs text-muted-foreground font-mono">{webhookTimeout} s</span>
                      </div>
                      <Slider
                        value={[parseFloat(webhookTimeout) || 10]}
                        onValueChange={([v]) => setWebhookTimeout(String(v))}
                        min={1}
                        max={30}
                        step={1}
                      />
                    </div>

                    {/* Webhook Events */}
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs">Webhook Events</Label>
                          <p className="text-[10px] text-muted-foreground">Choose which events trigger the webhook</p>
                        </div>
                        <Dialog open={webhookEventsDialogOpen} onOpenChange={setWebhookEventsDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              {webhookEvents.length > 0 ? `${webhookEvents.length} selected` : "Set Up"}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Webhook Events</DialogTitle>
                              <DialogDescription>Select which events should trigger your webhook.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                              {WEBHOOK_EVENT_OPTIONS.map((evt) => (
                                <label key={evt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <Checkbox
                                    checked={webhookEvents.includes(evt.value)}
                                    onCheckedChange={(checked) => {
                                      setWebhookEvents((prev) =>
                                        checked ? [...prev, evt.value] : prev.filter((e) => e !== evt.value)
                                      );
                                    }}
                                  />
                                  {evt.label}
                                </label>
                              ))}
                            </div>
                            <DialogFooter>
                              <Button onClick={() => setWebhookEventsDialogOpen(false)}>Done</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Agent Versioning */}
                <AccordionItem value="versioning">
                  <AccordionTrigger className="px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Versioning</span>
                      {hasUnpublishedChanges && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-400 text-amber-600 dark:text-amber-400">Draft</Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                    <p className="text-[11px] text-muted-foreground">
                      Publishing creates a snapshot of the current agent config. New calls will use the published version.
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={publishing}
                          className="gap-1.5 w-full"
                        >
                          {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          {publishing ? "Publishing..." : "Publish Version"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Publish Agent Version?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This creates a production snapshot. New calls will use this version.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={publishVersion}>Publish</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <div className="pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs">Version History</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={fetchVersions}
                          disabled={versionsLoading}
                          className="h-6 px-2 text-[10px]"
                        >
                          {versionsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        </Button>
                      </div>
                      {versions.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          {versionsLoading ? "Loading..." : "Click refresh to load versions."}
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {versions.map((v) => (
                            <div key={v.version} className="flex items-center justify-between p-2 bg-accent/30 rounded text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium">v{v.version}</span>
                                {v.is_published && (
                                  <Badge variant="default" className="text-[9px] h-4 px-1.5">Live</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">
                                  {v.created_at ? new Date(v.created_at).toLocaleDateString() : "—"}
                                </span>
                                {!v.is_published && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-1.5 text-[10px] gap-1"
                                        disabled={restoringVersion === v.version}
                                      >
                                        {restoringVersion === v.version ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Undo2 className="h-3 w-3" />
                                        )}
                                        Restore
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Restore Version {v.version}?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will apply the configuration from version {v.version} to the current agent. You can publish a new version afterward to make it live.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => restoreVersion(v.version)}>Restore</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* MCP Servers */}
                <AccordionItem value="mcp">
                  <AccordionTrigger className="px-4">
                    <div>
                      <span className="text-sm font-medium">MCP Servers</span>
                      <p className="text-xs text-muted-foreground font-normal">Model Context Protocol servers</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                    {mcpServers.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No MCP servers configured yet.
                      </p>
                    )}
                    {mcpServers.map((server) => (
                      <div
                        key={server.id}
                        className="flex items-start gap-2 p-3 bg-accent/30 rounded-lg"
                      >
                        <div className="flex-1 space-y-2">
                          <Input
                            value={server.name}
                            onChange={(e) =>
                              setMcpServers((prev) =>
                                prev.map((s) =>
                                  s.id === server.id
                                    ? { ...s, name: e.target.value }
                                    : s
                                )
                              )
                            }
                            placeholder="Server name"
                            className="text-sm h-8"
                          />
                          <Input
                            value={server.url}
                            onChange={(e) =>
                              setMcpServers((prev) =>
                                prev.map((s) =>
                                  s.id === server.id
                                    ? { ...s, url: e.target.value }
                                    : s
                                )
                              )
                            }
                            placeholder="Endpoint URL"
                            className="text-sm font-mono h-8"
                          />
                        </div>
                        <button
                          onClick={() => removeMcpServer(server.id)}
                          className="text-muted-foreground hover:text-red-600 transition-colors mt-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addMcpServer}
                      className="gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add MCP Server
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Right - Inline Test Panel */}
            {showTestPanel && (
              <div className="hidden lg:block">
                <div className="sticky top-6">
                  <AgentTestPanel
                    agentId={agentId}
                    isChat={isChat}
                    firstMessage={firstMessage}
                    onClose={() => setShowTestPanel(false)}
                  />
                </div>
              </div>
            )}

          </div>
        </TabsContent>

        <TabsContent value="widget" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left - Config */}
            <div className="space-y-4">
              <Card className="overflow-hidden animate-fade-in-up stagger-1 glass-card rounded-xl">
                <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-primary/10 dark:bg-primary/10 flex items-center justify-center">
                      <MessageSquareText className="w-3.5 h-3.5 text-primary dark:text-primary" />
                    </div>
                    <h3 className="font-semibold text-sm">Widget Message</h3>
                  </div>
                </div>
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Description</Label>
                    <Textarea
                      value={widgetDescription}
                      onChange={(e) => setWidgetDescription(e.target.value)}
                      rows={3}
                      className="text-sm"
                      placeholder={isChat ? "What visitors see when the chat opens..." : "What visitors see before starting a call..."}
                    />
                  </div>
                </CardContent>
              </Card>

              {!isChat && audioDevices.length > 0 && (
                <Card className="overflow-hidden animate-fade-in-up stagger-2 glass-card rounded-xl">
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-md bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center">
                        <Mic className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">Audio Input</h3>
                        <p className="text-[11px] text-muted-foreground">Select microphone for calls</p>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <Select
                      value={selectedDeviceId}
                      onValueChange={(value) => {
                        setSelectedDeviceId(value);
                        localStorage.setItem("preferred-audio-device", value);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="System default" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">System default</SelectItem>
                        {audioDevices.map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              )}

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
                onClick={handleWidgetSave}
                disabled={widgetSaving}
              >
                {widgetSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Widget Settings
              </Button>
            </div>

            {/* Right - Live Widget Preview */}
            <div className="lg:col-span-3">
              <Card className="overflow-hidden border-0 shadow-xl animate-fade-in-up stagger-4 rounded-xl">
                <div
                  className="px-6 py-4 text-white relative overflow-hidden"
                  style={{ backgroundColor: dashboardColor }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-black/5 to-transparent" />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{agentName || "Agent"}</h4>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("w-2 h-2 rounded-full", isCallActive ? "bg-green-400 animate-pulse" : "bg-white/50")} />
                          <p className="text-xs text-white/80">
                            {isChat
                              ? "Online"
                              : isCallActive
                                ? (isAgentTalking ? "Speaking..." : "Listening...")
                                : "Ready"}
                          </p>
                        </div>
                      </div>
                    </div>
                    {!isChat && isCallActive && (
                      <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1">
                        <Clock className="w-3 h-3 text-white/80" />
                        <span className="text-xs font-mono text-white/90">{formatDuration(callDuration)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-background">
                  {isChat ? (
                    /* Live chat widget */
                    <div className="flex flex-col" style={{ minHeight: 420 }}>
                      {!chatSessionId ? (
                        <div className="flex flex-col items-center justify-center py-16 px-8 gap-6">
                          <p className="text-sm text-center text-muted-foreground max-w-md">{widgetDescription}</p>
                          <div className="relative">
                            <button
                              onClick={startChatSession}
                              disabled={chatStarting}
                              className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shadow-xl disabled:opacity-50"
                              style={{ backgroundColor: dashboardColor }}
                            >
                              {chatStarting ? <Loader2 className="w-8 h-8 animate-spin" /> : <MessageSquareText className="w-8 h-8" />}
                            </button>
                            {!chatStarting && (
                              <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: dashboardColor }} />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {chatStarting ? "Starting chat session..." : "Click to start a live chat"}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3" style={{ maxHeight: 420 }}>
                            {chatMessages.map((msg, idx) => (
                              <div key={idx} className={cn("flex", msg.role === "agent" ? "justify-start" : "justify-end")}>
                                <div
                                  className={cn(
                                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                                    msg.role === "agent"
                                      ? "bg-white dark:bg-slate-800 border shadow-sm rounded-bl-md"
                                      : "text-white rounded-br-md"
                                  )}
                                  style={msg.role === "user" ? { backgroundColor: dashboardColor } : undefined}
                                >
                                  <span className="text-[10px] font-semibold uppercase block mb-0.5 opacity-60">
                                    {msg.role === "agent" ? agentName : "You"}
                                  </span>
                                  {msg.content}
                                </div>
                              </div>
                            ))}
                            {chatSending && (
                              <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-800 border shadow-sm rounded-2xl rounded-bl-md px-4 py-2.5">
                                  <div className="flex gap-1">
                                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                                  </div>
                                </div>
                              </div>
                            )}
                            <div ref={chatEndRef} />
                          </div>
                          <div className="border-t bg-white dark:bg-slate-900 px-4 py-3">
                            <form
                              onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }}
                              className="flex items-center gap-2"
                            >
                              <Input
                                placeholder="Type a message..."
                                className="flex-1 text-sm"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                disabled={chatSending}
                              />
                              <Button
                                type="submit"
                                size="icon"
                                className="shrink-0 text-white shadow-md"
                                style={{ backgroundColor: dashboardColor }}
                                disabled={!chatInput.trim() || chatSending}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            </form>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    /* Voice call widget preview */
                    <>
                      {!isCallActive && transcript.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-8 gap-6">
                          <p className="text-sm text-center text-muted-foreground max-w-md">{widgetDescription}</p>
                          <div className="relative">
                            <button
                              onClick={handleStartCall}
                              disabled={isConnecting}
                              className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shadow-xl disabled:opacity-50"
                              style={{ backgroundColor: dashboardColor }}
                            >
                              {isConnecting ? <Loader2 className="w-8 h-8 animate-spin" /> : <Phone className="w-8 h-8" />}
                            </button>
                            {!isConnecting && (
                              <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: dashboardColor }} />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isConnecting ? "Connecting to agent..." : "Click to start a live call"}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col" style={{ minHeight: 420 }}>
                          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3" style={{ maxHeight: 420 }}>
                            {transcript.length === 0 && isCallActive && (
                              <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                  <div className="w-12 h-12 rounded-full flex items-center justify-center animate-pulse" style={{ backgroundColor: `${dashboardColor}20` }}>
                                    <Mic className="w-5 h-5" style={{ color: dashboardColor }} />
                                  </div>
                                  <p className="text-sm">Waiting for conversation...</p>
                                </div>
                              </div>
                            )}
                            {transcript.map((entry, idx) => (
                              <div key={idx} className={cn("flex", entry.role === "agent" ? "justify-start" : "justify-end")}>
                                <div
                                  className={cn(
                                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                                    entry.role === "agent"
                                      ? "bg-white dark:bg-slate-800 border shadow-sm rounded-bl-md"
                                      : "text-white rounded-br-md"
                                  )}
                                  style={entry.role === "user" ? { backgroundColor: dashboardColor } : undefined}
                                >
                                  <span className="text-[10px] font-semibold uppercase block mb-0.5 opacity-60">
                                    {entry.role === "agent" ? agentName : "You"}
                                  </span>
                                  {entry.content}
                                </div>
                              </div>
                            ))}
                            <div ref={transcriptEndRef} />
                          </div>
                          <div className="border-t bg-white dark:bg-slate-900 px-6 py-4">
                            <div className="flex items-center justify-center gap-3">
                              {isCallActive ? (
                                <>
                                  <Button variant="outline" size="icon" className="rounded-full w-11 h-11" onClick={toggleMute}>
                                    {isMuted ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4" />}
                                  </Button>
                                  <Button size="icon" className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20" onClick={handleEndCall}>
                                    <PhoneOff className="w-5 h-5 text-white" />
                                  </Button>
                                  <Button variant="outline" size="icon" className="rounded-full w-11 h-11" onClick={handleResetCall} title="Reset call">
                                    <RotateCcw className="w-4 h-4" />
                                  </Button>
                                </>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <p className="text-sm text-muted-foreground">Call ended</p>
                                  <Button
                                    className="rounded-full px-6 text-white shadow-md"
                                    style={{ backgroundColor: dashboardColor }}
                                    onClick={handleStartCall}
                                    disabled={isConnecting}
                                  >
                                    <Phone className="w-4 h-4 mr-2" />
                                    {isConnecting ? "Connecting..." : "Call Again"}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ai-analysis" className="mt-6">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">Configure AI-powered conversation analysis features</p>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={handleAiSave}
              disabled={aiSaving}
            >
              {aiSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>

          <div className="space-y-4">
            <Card className="animate-fade-in-up stagger-1 glass-card rounded-xl">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Checkbox id="summary-enabled" checked={summaryEnabled} onCheckedChange={(checked) => setSummaryEnabled(!!checked)} />
                  <Label htmlFor="summary-enabled" className="cursor-pointer">
                    <CardTitle className="text-base">Summary</CardTitle>
                  </Label>
                </div>
              </CardHeader>
              {summaryEnabled && (
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Custom Prompt</Label>
                      <span className="text-xs text-muted-foreground">{summaryPrompt.length}/5000</span>
                    </div>
                    <Textarea
                      value={summaryPrompt}
                      onChange={(e) => setSummaryPrompt(e.target.value.slice(0, 5000))}
                      rows={4}
                      className="font-mono text-sm"
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            <Card className="animate-fade-in-up stagger-2 glass-card rounded-xl">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Checkbox id="evaluation-enabled" checked={evaluationEnabled} onCheckedChange={(checked) => setEvaluationEnabled(!!checked)} />
                  <Label htmlFor="evaluation-enabled" className="cursor-pointer">
                    <CardTitle className="text-base">Evaluation</CardTitle>
                  </Label>
                </div>
              </CardHeader>
              {evaluationEnabled && (
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Custom Prompt</Label>
                      <span className="text-xs text-muted-foreground">{evaluationPrompt.length}/5000</span>
                    </div>
                    <Textarea
                      value={evaluationPrompt}
                      onChange={(e) => setEvaluationPrompt(e.target.value.slice(0, 5000))}
                      rows={4}
                      className="font-mono text-sm"
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            <Card className="animate-fade-in-up stagger-3 glass-card rounded-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox id="auto-tagging-enabled" checked={autoTaggingEnabled} onCheckedChange={(checked) => setAutoTaggingEnabled(!!checked)} />
                    <Label htmlFor="auto-tagging-enabled" className="cursor-pointer">
                      <CardTitle className="text-base">Auto-Tagging</CardTitle>
                    </Label>
                  </div>
                  {autoTaggingEnabled && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info("Auto-tagging will run on the next call")}
                    >
                      <Zap className="w-3.5 h-3.5 mr-1.5" />
                      Manual Trigger
                    </Button>
                  )}
                </div>
              </CardHeader>
              {autoTaggingEnabled && (
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Custom Prompt</Label>
                      <span className="text-xs text-muted-foreground">{autoTaggingPrompt.length}/5000</span>
                    </div>
                    <Textarea
                      value={autoTaggingPrompt}
                      onChange={(e) => setAutoTaggingPrompt(e.target.value.slice(0, 5000))}
                      rows={4}
                      className="font-mono text-sm"
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            <Card className="animate-fade-in-up stagger-4 glass-card rounded-xl">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox id="misunderstood-enabled" checked={misunderstoodEnabled} onCheckedChange={(checked) => setMisunderstoodEnabled(!!checked)} />
                    <Label htmlFor="misunderstood-enabled" className="cursor-pointer">
                      <CardTitle className="text-base">Misunderstood Queries</CardTitle>
                    </Label>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-[250px] text-xs">
                        When enabled, the AI will identify queries where the agent may have misunderstood the {isChat ? "user" : "caller"}&apos;s intent.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              {misunderstoodEnabled && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    The system will automatically flag conversations where the agent appears to have misunderstood the {isChat ? "user" : "caller"}&apos;s question or intent.
                  </p>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

      </Tabs>

    </div>
    </FeatureGate>
  );
}
