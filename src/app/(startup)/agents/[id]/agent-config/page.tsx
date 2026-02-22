"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  RotateCcw,
  Undo2,
  GitBranch,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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

interface FunctionTool {
  id: string;
  name: string;
  description: string;
  type?: string;
  // agent_swap
  agent_id?: string;
  post_call_analysis_setting?: string;
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
  // custom tool
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  parameters?: { properties: Record<string, unknown>; type: string; required?: string[] };
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

const PII_CATEGORIES = [
  { key: "person_name", label: "Person Name" },
  { key: "phone_number", label: "Phone Number" },
  { key: "email", label: "Email" },
  { key: "address", label: "Address" },
  { key: "ssn", label: "SSN" },
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "credit_card", label: "Credit Card" },
  { key: "bank_account", label: "Bank Account" },
  { key: "driver_license", label: "Driver License" },
  { key: "passport", label: "Passport" },
  { key: "medical_id", label: "Medical ID" },
  { key: "password", label: "Password" },
  { key: "pin", label: "PIN" },
];

function AgentConfigCollapsiblePanel({
  id,
  title,
  badge,
  children,
  openPanels,
  togglePanel,
}: {
  id: string;
  title: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
  openPanels: Record<string, boolean>;
  togglePanel: (panel: string) => void;
}) {
  const isOpen = openPanels[id];
  return (
    <Collapsible open={isOpen} onOpenChange={() => togglePanel(id)}>
      <div className="border border-[#e5e7eb] rounded-lg">
        <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#111827]">{title}</span>
            {badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-[#6b7280]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#6b7280]" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 border-t border-[#e5e7eb] space-y-4">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function AgentConfigPage() {
  const { id: agentId } = useParams<{ id: string }>();

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Main editor state
  const [llmId, setLlmId] = useState<string | null>(null);
  const [language, setLanguage] = useState("en-US");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [llmModel, setLlmModel] = useState("gpt-4.1");
  const [voice, setVoice] = useState("Hailey");
  const [firstMessage, setFirstMessage] = useState("");

  // Voice controls
  const [voiceModel, setVoiceModel] = useState<string | null>(null);
  const [voiceSpeed, setVoiceSpeed] = useState([1.0]);
  const [voiceTemperature, setVoiceTemperature] = useState([1.0]);
  const [voiceVolume, setVoiceVolume] = useState([1.0]);

  // Advanced LLM
  const [modelHighPriority, setModelHighPriority] = useState(false);
  const [toolCallStrictMode, setToolCallStrictMode] = useState(false);

  // Collapsible panel states
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({
    tools: false,
    speech: false,
    transcription: false,
    call: false,
    postCall: false,
    security: false,
    mcps: false,
    webhook: false,
    advancedLlm: false,
    kbConfig: false,
    versioning: false,
  });

  // Tools state
  const [functions, setFunctions] = useState<FunctionTool[]>([]);
  const [newToolType, setNewToolType] = useState("custom");

  // Speech settings state
  const [responsiveness, setResponsiveness] = useState([0.5]);
  const [interruptionSensitivity, setInterruptionSensitivity] = useState([0.5]);
  const [backgroundSound, setBackgroundSound] = useState("off");
  const [backgroundVolume, setBackgroundVolume] = useState([0.5]);
  const [backchanneling, setBackchanneling] = useState(false);
  const [backchannelFrequency, setBackchannelFrequency] = useState([0.8]);
  const [backchannelWords, setBackchannelWords] = useState("yeah, uh-huh");
  const [speechNormalization, setSpeechNormalization] = useState(false);
  const [reminderFrequency, setReminderFrequency] = useState("");
  const [reminderMaxCount, setReminderMaxCount] = useState("");
  const [pronunciationEntries, setPronunciationEntries] = useState<{ word: string; pronunciation: string }[]>([]);

  // Transcription state
  const [denoisingMode, setDenoisingMode] = useState("noise-cancellation");
  const [transcriptionMode, setTranscriptionMode] = useState("fast");
  const [vocabulary, setVocabulary] = useState("");
  const [boostedKeywords, setBoostedKeywords] = useState("");

  // Call settings state
  const [voicemailDetection, setVoicemailDetection] = useState(false);
  const [voicemailAction, setVoicemailAction] = useState("hangup");
  const [voicemailText, setVoicemailText] = useState("");
  const [keypadInput, setKeypadInput] = useState(false);
  const [dtmfDigitLimit, setDtmfDigitLimit] = useState("");
  const [dtmfTerminationKey, setDtmfTerminationKey] = useState("");
  const [dtmfTimeout, setDtmfTimeout] = useState("");
  const [silenceTimeout, setSilenceTimeout] = useState("30");
  const [maxDuration, setMaxDuration] = useState("3600");
  const [pauseBeforeSpeaking, setPauseBeforeSpeaking] = useState("0.4");
  const [ringDuration, setRingDuration] = useState("15");

  // Post call analysis state
  const [postCallModel, setPostCallModel] = useState("gpt-4o");
  const [analysisDataConfig, setAnalysisDataConfig] = useState("");

  // Security fallback state
  const [dataStorage, setDataStorage] = useState("everything");
  const [piiRedaction, setPiiRedaction] = useState(false);
  const [piiCategories, setPiiCategories] = useState<string[]>([]);
  const [secureUrls, setSecureUrls] = useState(false);
  const [signedUrlExpiration, setSignedUrlExpiration] = useState("24");
  const [fallbackVoiceIds, setFallbackVoiceIds] = useState("");
  const [defaultDynamicVars, setDefaultDynamicVars] = useState("");

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookTimeout, setWebhookTimeout] = useState("10");

  // KB config state
  const [kbTopK, setKbTopK] = useState("5");
  const [kbFilterScore, setKbFilterScore] = useState("0.7");
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<string[]>([]);

  // MCPs state
  const [mcpServers, setMcpServers] = useState<
    { id: string; name: string; url: string }[]
  >([]);

  // Versioning state
  const [publishing, setPublishing] = useState(false);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [versions, setVersions] = useState<{ version: number; is_published: boolean; created_at: number | null }[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);

  async function fetchVersions() {
    if (!agentId) return;
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/versions`);
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
    if (!agentId) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/publish`, { method: "POST" });
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
    if (!agentId) return;
    setRestoringVersion(version);
    try {
      const res = await fetch(`/api/agents/${agentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      if (res.ok) {
        toast.success(`Restored to version ${version}`);
        setHasUnpublishedChanges(true);
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

  // Fetch config from API
  const fetchConfig = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/config`);
      if (!res.ok) throw new Error("Failed to fetch config");
      const data = await res.json();

      // Main fields
      setLlmId(data.llm_id ?? null);
      setLanguage(data.language ?? "en-US");
      setSystemPrompt(data.system_prompt ?? "");
      setLlmModel(data.llm_model ?? "gpt-4.1");
      setVoice(data.voice ?? "Hailey");
      setFirstMessage(data.first_message ?? "");

      // Voice controls
      if (data.voice_model != null) setVoiceModel(data.voice_model);
      if (data.voice_speed != null) setVoiceSpeed([data.voice_speed]);
      if (data.voice_temperature != null) setVoiceTemperature([data.voice_temperature]);
      if (data.volume != null) setVoiceVolume([data.volume]);

      // Advanced LLM
      setModelHighPriority(data.model_high_priority ?? false);
      setToolCallStrictMode(data.tool_call_strict_mode ?? false);

      // KB config
      if (data.kb_config) {
        setKbTopK(String(data.kb_config.top_k ?? 5));
        setKbFilterScore(String(data.kb_config.filter_score ?? 0.7));
      }
      if (Array.isArray(data.knowledge_base_ids)) {
        setKnowledgeBaseIds(data.knowledge_base_ids);
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
        }
        setSpeechNormalization(ss.speech_normalization ?? false);
        if (ss.reminder_frequency_sec != null) setReminderFrequency(String(ss.reminder_frequency_sec));
        if (ss.reminder_max_count != null) setReminderMaxCount(String(ss.reminder_max_count));
        if (Array.isArray(ss.pronunciation)) {
          setPronunciationEntries(
            ss.pronunciation.map((p: Record<string, string>) => ({
              word: p.word ?? "",
              pronunciation: p.phoneme ?? p.pronunciation ?? "",
            }))
          );
        }
      }

      // Realtime transcription
      const rt = data.realtime_transcription;
      if (rt) {
        setDenoisingMode(rt.denoising_mode ?? "noise-cancellation");
        setTranscriptionMode(rt.transcription_mode ?? "fast");
        if (Array.isArray(rt.vocabulary_specialization)) {
          setVocabulary(rt.vocabulary_specialization.join(", "));
        } else {
          setVocabulary(rt.vocabulary_specialization ?? "");
        }
        if (Array.isArray(rt.boosted_keywords)) {
          setBoostedKeywords(rt.boosted_keywords.join(", "));
        } else {
          setBoostedKeywords(rt.boosted_keywords ?? "");
        }
      }

      // Call settings — convert ms to seconds for UI display
      const cs = data.call_settings;
      if (cs) {
        setVoicemailDetection(cs.voicemail_detection ?? false);
        if (cs.voicemail_option) {
          setVoicemailAction(cs.voicemail_option.type ?? "hangup");
          setVoicemailText(cs.voicemail_option.text ?? "");
        }
        setKeypadInput(cs.keypad_input_detection ?? false);
        if (cs.dtmf_options) {
          setDtmfDigitLimit(cs.dtmf_options.digit_limit != null ? String(cs.dtmf_options.digit_limit) : "");
          setDtmfTerminationKey(cs.dtmf_options.termination_key ?? cs.dtmf_options.end_character ?? "");
          setDtmfTimeout(cs.dtmf_options.timeout_ms != null ? String(cs.dtmf_options.timeout_ms / 1000) : "5");
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
        setPostCallModel(pca.model ?? "gpt-4o");
        if (pca.data != null && typeof pca.data === "object") {
          setAnalysisDataConfig(JSON.stringify(pca.data, null, 2));
        } else {
          setAnalysisDataConfig(pca.data ?? "");
        }
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
        if (sf.default_dynamic_vars != null && typeof sf.default_dynamic_vars === "object") {
          setDefaultDynamicVars(JSON.stringify(sf.default_dynamic_vars, null, 2));
        } else {
          setDefaultDynamicVars(sf.default_dynamic_vars ?? "");
        }
      }

      // Webhook
      const wh = data.webhook;
      if (wh) {
        setWebhookUrl(wh.url ?? "");
        setWebhookTimeout(wh.timeout_ms != null ? String(wh.timeout_ms / 1000) : "10");
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
    } catch (err) {
      console.error("Failed to fetch agent config:", err);
      toast.error("Failed to load agent configuration");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Save config to API
  async function handleSave() {
    if (!agentId) return;
    setSaving(true);

    const parsedBoostedKeywords = boostedKeywords.split(",").map((s) => s.trim()).filter(Boolean);
    const parsedVocabulary = vocabulary.trim();
    const parsedFallbackVoiceIds = fallbackVoiceIds.split(",").map((s) => s.trim()).filter(Boolean);

    let parsedDynamicVars: Record<string, string> | undefined;
    if (defaultDynamicVars.trim()) {
      try {
        parsedDynamicVars = JSON.parse(defaultDynamicVars);
      } catch {
        toast.error("Invalid JSON in Default Dynamic Variables.");
        setSaving(false);
        return;
      }
    }

    let parsedAnalysisData: unknown | undefined;
    if (analysisDataConfig.trim()) {
      try {
        parsedAnalysisData = JSON.parse(analysisDataConfig);
      } catch {
        toast.error("Invalid JSON in Analysis Data Configuration.");
        setSaving(false);
        return;
      }
    }

    // Build voicemail_option for payload (flat structure -- API route wraps in { action } for Retell)
    let voicemailOption = null;
    if (voicemailDetection) {
      if (voicemailAction === "hangup") {
        voicemailOption = { type: "hangup" };
      } else if ((voicemailAction === "prompt" || voicemailAction === "static_text") && voicemailText.trim()) {
        voicemailOption = { type: voicemailAction, text: voicemailText.trim() };
      }
    }

    // Build dtmf_options for payload
    let dtmfOptions: Record<string, unknown> | null = null;
    if (keypadInput) {
      const opts: Record<string, unknown> = {};
      if (dtmfDigitLimit) opts.digit_limit = parseInt(dtmfDigitLimit);
      if (dtmfTerminationKey) opts.termination_key = dtmfTerminationKey;
      opts.timeout_ms = (parseFloat(dtmfTimeout) || 5) * 1000;
      if (Object.keys(opts).length > 0) dtmfOptions = opts;
    }

    const payload: Record<string, unknown> = {
      ...(llmId && { llm_id: llmId }),
      language,
      system_prompt: systemPrompt,
      llm_model: llmModel,
      voice,
      first_message: firstMessage,
      voice_model: voiceModel,
      voice_speed: voiceSpeed[0],
      voice_temperature: voiceTemperature[0],
      volume: voiceVolume[0],
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
      speech_settings: {
        background_sound: backgroundSound,
        background_sound_volume: backgroundVolume[0],
        responsiveness: responsiveness[0],
        interruption_sensitivity: interruptionSensitivity[0],
        enable_backchanneling: backchanneling,
        backchannel_frequency: backchannelFrequency[0],
        backchannel_words: backchannelWords.split(",").map((s) => s.trim()).filter(Boolean),
        speech_normalization: speechNormalization,
        ...(reminderFrequency ? { reminder_frequency_sec: parseFloat(reminderFrequency) } : {}),
        ...(reminderMaxCount ? { reminder_max_count: parseInt(reminderMaxCount) } : {}),
        pronunciation: pronunciationEntries
          .filter((p) => p.word && p.pronunciation)
          .map((p) => ({ word: p.word, phoneme: p.pronunciation, alphabet: "ipa" })),
      },
      realtime_transcription: {
        denoising_mode: denoisingMode,
        transcription_mode: transcriptionMode,
        vocabulary_specialization: parsedVocabulary,
        boosted_keywords: parsedBoostedKeywords,
      },
      call_settings: {
        voicemail_detection: voicemailDetection,
        ...(voicemailOption && { voicemail_option: voicemailOption }),
        keypad_input_detection: keypadInput,
        ...(dtmfOptions && { dtmf_options: dtmfOptions }),
        end_call_after_silence: parseFloat(silenceTimeout) * 1000,
        max_call_duration: parseFloat(maxDuration) * 1000,
        begin_message_delay: parseFloat(pauseBeforeSpeaking) * 1000,
        ring_duration: parseFloat(ringDuration) * 1000,
      },
      post_call_analysis: {
        model: postCallModel,
        data: parsedAnalysisData,
      },
      security_fallback: {
        data_storage_setting: dataStorage,
        pii_redaction: piiRedaction,
        ...(piiRedaction && piiCategories.length > 0 ? { pii_categories: piiCategories } : {}),
        secure_urls: secureUrls,
        ...(secureUrls ? { signed_url_expiration_hours: parseFloat(signedUrlExpiration) || 24 } : {}),
        fallback_voice_ids: parsedFallbackVoiceIds,
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
    };

    try {
      const res = await fetch(`/api/agents/${agentId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? "Failed to save config");
      }

      toast.success("Agent configuration saved successfully");
      setHasUnpublishedChanges(true);
    } catch (err) {
      console.error("Failed to save agent config:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  function togglePanel(panel: string) {
    setOpenPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  }

  function addFunction() {
    const base: FunctionTool = { id: Date.now().toString(), name: "", description: "", type: newToolType };
    const typeDefaults: Record<string, Partial<FunctionTool>> = {
      agent_swap: { agent_id: "", post_call_analysis_setting: "both_agents" },
      send_sms: { sms_content: { type: "predefined", content: "" } },
      mcp: { mcp_id: "" },
      extract_dynamic_variable: { variables: [] },
      transfer_call: {
        transfer_destination: { type: "predefined", number: "" },
        transfer_option: { type: "cold_transfer" },
      },
      custom: { url: "", method: "POST", speak_after_execution: true },
    };
    setFunctions((prev) => [...prev, { ...base, ...(typeDefaults[newToolType] || {}) }]);
  }

  function removeFunction(id: string) {
    setFunctions((prev) => prev.filter((f) => f.id !== id));
  }

  function updateTool(id: string, updates: Partial<FunctionTool>) {
    setFunctions((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Save button */}
      <div className="absolute top-0 right-0">
        <Button
          className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
          onClick={handleSave}
          disabled={saving}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pr-0 lg:pr-24">
        {/* LEFT SIDE - Main Editor */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-[#111827]">
            Agent Configuration
          </h2>

          {/* System Prompt */}
          <div>
            <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
              System Prompt
            </Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={12}
              className="font-mono text-sm resize-y"
              placeholder="Enter the system prompt that defines this agent's behavior..."
            />
          </div>

          {/* Language + LLM Model + Voice row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="en-GB">English (UK)</SelectItem>
                  <SelectItem value="es-ES">Spanish</SelectItem>
                  <SelectItem value="es-419">Spanish (LatAm)</SelectItem>
                  <SelectItem value="fr-FR">French</SelectItem>
                  <SelectItem value="de-DE">German</SelectItem>
                  <SelectItem value="it-IT">Italian</SelectItem>
                  <SelectItem value="pt-BR">Portuguese (BR)</SelectItem>
                  <SelectItem value="nl-NL">Dutch</SelectItem>
                  <SelectItem value="zh-CN">Chinese</SelectItem>
                  <SelectItem value="ja-JP">Japanese</SelectItem>
                  <SelectItem value="ko-KR">Korean</SelectItem>
                  <SelectItem value="hi-IN">Hindi</SelectItem>
                  <SelectItem value="ar-SA">Arabic</SelectItem>
                  <SelectItem value="ru-RU">Russian</SelectItem>
                  <SelectItem value="pl-PL">Polish</SelectItem>
                  <SelectItem value="tr-TR">Turkish</SelectItem>
                  <SelectItem value="multi">Multilingual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">LLM Model</Label>
              <Select value={llmModel} onValueChange={setLlmModel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
                  <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                  <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-5-nano">GPT-5 Nano</SelectItem>
                  <SelectItem value="gpt-5-mini">GPT-5 Mini</SelectItem>
                  <SelectItem value="gpt-5">GPT-5</SelectItem>
                  <SelectItem value="claude-3.5-haiku">Claude 3.5 Haiku</SelectItem>
                  <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                  <SelectItem value="claude-4.5-haiku">Claude 4.5 Haiku</SelectItem>
                  <SelectItem value="claude-4.5-sonnet">Claude 4.5 Sonnet</SelectItem>
                  <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
                  <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                  <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                  <SelectItem value="deepseek-v3">DeepSeek V3</SelectItem>
                  <SelectItem value="deepseek-r1">DeepSeek R1</SelectItem>
                  <SelectItem value="grok-3-mini-fast">Grok 3 Mini Fast</SelectItem>
                  <SelectItem value="llama-3.3-70b">Llama 3.3 70B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">Voice</Label>
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hailey">Hailey</SelectItem>
                  <SelectItem value="Grace">Grace</SelectItem>
                  <SelectItem value="Nova">Nova</SelectItem>
                  <SelectItem value="Aria">Aria</SelectItem>
                  <SelectItem value="Luna">Luna</SelectItem>
                  <SelectItem value="Stella">Stella</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Voice Model */}
          <div>
            <Label className="text-sm font-medium text-[#111827] mb-1.5 block">Voice Model</Label>
            <Select value={voiceModel ?? "auto"} onValueChange={(v) => setVoiceModel(v === "auto" ? null : v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Default)</SelectItem>
                <SelectItem value="eleven_turbo_v2">Eleven Turbo v2</SelectItem>
                <SelectItem value="eleven_turbo_v2_5">Eleven Turbo v2.5</SelectItem>
                <SelectItem value="eleven_flash_v2">Eleven Flash v2</SelectItem>
                <SelectItem value="eleven_flash_v2_5">Eleven Flash v2.5</SelectItem>
                <SelectItem value="eleven_multilingual_v2">Eleven Multilingual v2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Voice Speed / Temperature / Volume */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-sm text-[#111827]">Speed</Label>
                <span className="text-xs text-[#6b7280] font-mono">{voiceSpeed[0].toFixed(2)}</span>
              </div>
              <Slider value={voiceSpeed} onValueChange={setVoiceSpeed} min={0.5} max={2} step={0.05} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-sm text-[#111827]">Temperature</Label>
                <span className="text-xs text-[#6b7280] font-mono">{voiceTemperature[0].toFixed(2)}</span>
              </div>
              <Slider value={voiceTemperature} onValueChange={setVoiceTemperature} min={0} max={2} step={0.05} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-sm text-[#111827]">Volume</Label>
                <span className="text-xs text-[#6b7280] font-mono">{voiceVolume[0].toFixed(2)}</span>
              </div>
              <Slider value={voiceVolume} onValueChange={setVoiceVolume} min={0} max={2} step={0.05} />
            </div>
          </div>

          {/* First Message */}
          <div>
            <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
              First Message
            </Label>
            <Input
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              placeholder="The first message the agent says when a call starts..."
              className="text-sm"
            />
          </div>

          {/* Edit Prompt Tree CTA */}
          <Link href={`/agents/${agentId}/prompt-tree`} className="block mt-4">
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
        </div>

        {/* RIGHT SIDE - Collapsible Panels */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[#111827]">
            Advanced Settings
          </h2>

          {/* 1. Tools */}
          <AgentConfigCollapsiblePanel openPanels={openPanels} togglePanel={togglePanel} id="tools" title="Tools" badge={functions.length > 0 ? String(functions.length) : undefined}>
            <div className="space-y-3">
              {functions.map((fn) => (
                <div key={fn.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {TOOL_TYPE_LABELS[fn.type || "custom"] || fn.type || "custom"}
                    </Badge>
                    <button onClick={() => removeFunction(fn.id)} className="text-[#6b7280] hover:text-red-600 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Input
                    value={fn.name}
                    onChange={(e) => updateTool(fn.id, { name: e.target.value })}
                    placeholder="Tool name"
                    className="text-sm font-mono"
                  />
                  <Input
                    value={fn.description}
                    onChange={(e) => updateTool(fn.id, { description: e.target.value })}
                    placeholder="Description"
                    className="text-sm"
                  />

                  {/* Agent Swap */}
                  {fn.type === "agent_swap" && (
                    <div className="space-y-2 pt-1 border-t border-gray-200">
                      <div>
                        <Label className="text-xs">Destination Agent ID</Label>
                        <Input value={fn.agent_id || ""} onChange={(e) => updateTool(fn.id, { agent_id: e.target.value })} placeholder="agent_xxxxxxxx" className="text-sm font-mono mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Post-Call Analysis</Label>
                        <Select value={fn.post_call_analysis_setting || "both_agents"} onValueChange={(v) => updateTool(fn.id, { post_call_analysis_setting: v })}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="both_agents">Both Agents</SelectItem>
                            <SelectItem value="only_destination_agent">Destination Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Send SMS */}
                  {fn.type === "send_sms" && (
                    <div className="space-y-2 pt-1 border-t border-gray-200">
                      <div>
                        <Label className="text-xs">SMS Content Type</Label>
                        <Select value={fn.sms_content?.type || "predefined"} onValueChange={(v) => updateTool(fn.id, { sms_content: { ...fn.sms_content, type: v } })}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="predefined">Predefined</SelectItem>
                            <SelectItem value="inferred">AI-Inferred</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea
                        value={fn.sms_content?.type === "inferred" ? (fn.sms_content?.prompt || "") : (fn.sms_content?.content || "")}
                        onChange={(e) => {
                          const field = fn.sms_content?.type === "inferred" ? "prompt" : "content";
                          updateTool(fn.id, { sms_content: { ...fn.sms_content, [field]: e.target.value } });
                        }}
                        placeholder={fn.sms_content?.type === "inferred" ? "Describe what SMS to generate..." : "Enter SMS text..."}
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  )}

                  {/* MCP Tool */}
                  {fn.type === "mcp" && (
                    <div className="space-y-2 pt-1 border-t border-gray-200">
                      <div>
                        <Label className="text-xs">MCP Server ID</Label>
                        <Input value={fn.mcp_id || ""} onChange={(e) => updateTool(fn.id, { mcp_id: e.target.value })} placeholder="Optional" className="text-sm font-mono mt-1" />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 text-xs">
                          <Checkbox checked={fn.speak_during_execution ?? false} onCheckedChange={(v) => updateTool(fn.id, { speak_during_execution: !!v })} className="h-3.5 w-3.5" />
                          Speak during
                        </label>
                        <label className="flex items-center gap-1.5 text-xs">
                          <Checkbox checked={fn.speak_after_execution ?? false} onCheckedChange={(v) => updateTool(fn.id, { speak_after_execution: !!v })} className="h-3.5 w-3.5" />
                          Speak after
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Extract Dynamic Variable */}
                  {fn.type === "extract_dynamic_variable" && (
                    <div className="space-y-2 pt-1 border-t border-gray-200">
                      <Label className="text-xs">Variables</Label>
                      {(fn.variables || []).map((v, vi) => (
                        <div key={vi} className="flex items-start gap-1.5 p-2 bg-white rounded">
                          <div className="flex-1 grid grid-cols-[1fr_1fr_auto] gap-1.5">
                            <Input value={v.name} onChange={(e) => { const vars = [...(fn.variables || [])]; vars[vi] = { ...vars[vi], name: e.target.value }; updateTool(fn.id, { variables: vars }); }} placeholder="Name" className="text-xs font-mono h-7" />
                            <Input value={v.description} onChange={(e) => { const vars = [...(fn.variables || [])]; vars[vi] = { ...vars[vi], description: e.target.value }; updateTool(fn.id, { variables: vars }); }} placeholder="Description" className="text-xs h-7" />
                            <Select value={v.type || "string"} onValueChange={(val) => { const vars = [...(fn.variables || [])]; vars[vi] = { ...vars[vi], type: val }; updateTool(fn.id, { variables: vars }); }}>
                              <SelectTrigger className="h-7 text-[10px] w-20"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">String</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="boolean">Boolean</SelectItem>
                                <SelectItem value="enum">Enum</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <button onClick={() => { updateTool(fn.id, { variables: (fn.variables || []).filter((_, i) => i !== vi) }); }} className="text-[#6b7280] hover:text-red-600 mt-1">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => updateTool(fn.id, { variables: [...(fn.variables || []), { name: "", description: "", type: "string" }] })} className="gap-1 h-7 text-xs">
                        <Plus className="h-3 w-3" /> Add Variable
                      </Button>
                    </div>
                  )}

                  {/* Transfer Call */}
                  {fn.type === "transfer_call" && (
                    <div className="space-y-2 pt-1 border-t border-gray-200">
                      <div>
                        <Label className="text-xs">Destination Type</Label>
                        <Select value={fn.transfer_destination?.type || "predefined"} onValueChange={(v) => updateTool(fn.id, { transfer_destination: { ...fn.transfer_destination, type: v } })}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="predefined">Predefined Number</SelectItem>
                            <SelectItem value="inferred">AI-Inferred</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {fn.transfer_destination?.type === "inferred" ? (
                        <Textarea value={fn.transfer_destination?.prompt || ""} onChange={(e) => updateTool(fn.id, { transfer_destination: { ...fn.transfer_destination, prompt: e.target.value } })} placeholder="Describe how to determine the transfer number..." rows={2} className="text-sm" />
                      ) : (
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <div>
                            <Label className="text-xs">Phone Number</Label>
                            <Input value={fn.transfer_destination?.number || ""} onChange={(e) => updateTool(fn.id, { transfer_destination: { ...fn.transfer_destination, number: e.target.value } })} placeholder="+1234567890" className="text-sm font-mono mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">Extension</Label>
                            <Input value={fn.transfer_destination?.extension || ""} onChange={(e) => updateTool(fn.id, { transfer_destination: { ...fn.transfer_destination, extension: e.target.value } })} placeholder="Opt." className="text-sm font-mono mt-1 w-20" />
                          </div>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs">Transfer Mode</Label>
                        <Select value={fn.transfer_option?.type || "cold_transfer"} onValueChange={(v) => updateTool(fn.id, { transfer_option: { ...fn.transfer_option, type: v } })}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cold_transfer">Cold Transfer</SelectItem>
                            <SelectItem value="warm_transfer">Warm Transfer</SelectItem>
                            <SelectItem value="agentic_warm_transfer">Agentic Warm Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {(fn.transfer_option?.type === "warm_transfer" || fn.transfer_option?.type === "agentic_warm_transfer") && (
                        <div className="space-y-2 pl-3 border-l-2 border-blue-200 ml-1">
                          <div>
                            <Label className="text-xs">Hold Music</Label>
                            <Select value={fn.transfer_option?.on_hold_music || "none"} onValueChange={(v) => updateTool(fn.id, { transfer_option: { ...fn.transfer_option, on_hold_music: v } })}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="relaxing_sound">Relaxing Sound</SelectItem>
                                <SelectItem value="uplifting_beats">Uplifting Beats</SelectItem>
                                <SelectItem value="ringtone">Ringtone</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                      <label className="flex items-center gap-1.5 text-xs">
                        <Checkbox checked={fn.transfer_option?.show_transferee_as_caller ?? false} onCheckedChange={(v) => updateTool(fn.id, { transfer_option: { ...fn.transfer_option, show_transferee_as_caller: !!v } })} className="h-3.5 w-3.5" />
                        Show original caller ID
                      </label>
                    </div>
                  )}

                  {/* Custom Tool */}
                  {fn.type === "custom" && (
                    <div className="space-y-2 pt-1 border-t border-gray-200">
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <div>
                          <Label className="text-xs">Webhook URL</Label>
                          <Input value={(fn.url as string) || ""} onChange={(e) => updateTool(fn.id, { url: e.target.value })} placeholder="https://your-server.com/tool" className="text-xs font-mono mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Method</Label>
                          <Select value={(fn.method as string) || "POST"} onValueChange={(v) => updateTool(fn.id, { method: v })}>
                            <SelectTrigger className="mt-1 w-24"><SelectValue /></SelectTrigger>
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
                      <div>
                        <Label className="text-xs">Headers (JSON)</Label>
                        <Textarea
                          value={fn.headers ? JSON.stringify(fn.headers, null, 2) : "{}"}
                          onChange={(e) => { try { updateTool(fn.id, { headers: JSON.parse(e.target.value) }); } catch { /* allow invalid while typing */ } }}
                          rows={2} className="text-xs font-mono mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Parameters Schema (JSON)</Label>
                        <Textarea
                          value={fn.parameters ? JSON.stringify(fn.parameters, null, 2) : '{"properties": {}, "type": "object"}'}
                          onChange={(e) => { try { updateTool(fn.id, { parameters: JSON.parse(e.target.value) }); } catch { /* allow invalid while typing */ } }}
                          rows={3} className="text-xs font-mono mt-1"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 text-xs">
                          <Checkbox checked={fn.speak_during_execution ?? false} onCheckedChange={(v) => updateTool(fn.id, { speak_during_execution: !!v })} className="h-3.5 w-3.5" />
                          Speak during
                        </label>
                        <label className="flex items-center gap-1.5 text-xs">
                          <Checkbox checked={fn.speak_after_execution ?? true} onCheckedChange={(v) => updateTool(fn.id, { speak_after_execution: !!v })} className="h-3.5 w-3.5" />
                          Speak after
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Select value={newToolType} onValueChange={setNewToolType}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Tool type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom Function</SelectItem>
                    <SelectItem value="end_call">End Call</SelectItem>
                    <SelectItem value="agent_swap">Agent Swap</SelectItem>
                    <SelectItem value="send_sms">Send SMS</SelectItem>
                    <SelectItem value="mcp">MCP Tool</SelectItem>
                    <SelectItem value="extract_dynamic_variable">Extract Variable</SelectItem>
                    <SelectItem value="transfer_call">Transfer Call</SelectItem>
                    <SelectItem value="press_digit">Press Digit</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={addFunction} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add Tool
                </Button>
              </div>
            </div>
          </AgentConfigCollapsiblePanel>

          {/* 2. Speech Settings */}
          <AgentConfigCollapsiblePanel openPanels={openPanels} togglePanel={togglePanel} id="speech" title="Speech Settings">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm text-[#111827]">Responsiveness</Label>
                <span className="text-xs text-[#6b7280] font-mono">{responsiveness[0].toFixed(2)}</span>
              </div>
              <Slider value={responsiveness} onValueChange={setResponsiveness} min={0} max={1} step={0.01} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm text-[#111827]">Interruption Sensitivity</Label>
                <span className="text-xs text-[#6b7280] font-mono">{interruptionSensitivity[0].toFixed(2)}</span>
              </div>
              <Slider value={interruptionSensitivity} onValueChange={setInterruptionSensitivity} min={0} max={1} step={0.01} />
            </div>
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">Background Sound</Label>
              <Select value={backgroundSound} onValueChange={setBackgroundSound}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-[#111827]">Background Volume</Label>
                  <span className="text-xs text-[#6b7280] font-mono">{backgroundVolume[0].toFixed(2)}</span>
                </div>
                <Slider value={backgroundVolume} onValueChange={setBackgroundVolume} min={0} max={1} step={0.01} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#111827]">Backchanneling</Label>
              <Switch checked={backchanneling} onCheckedChange={setBackchanneling} />
            </div>
            {backchanneling && (
              <div className="space-y-3 pl-3 border-l-2 border-blue-200 ml-1">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs">Backchannel Frequency</Label>
                    <span className="text-xs text-[#6b7280] font-mono">{backchannelFrequency[0].toFixed(2)}</span>
                  </div>
                  <Slider value={backchannelFrequency} onValueChange={setBackchannelFrequency} min={0} max={1} step={0.01} />
                </div>
                <div>
                  <Label className="text-xs">Backchannel Words</Label>
                  <Input value={backchannelWords} onChange={(e) => setBackchannelWords(e.target.value)} placeholder="yeah, uh-huh, right" className="text-sm mt-1" />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#111827]">Speech Normalization</Label>
              <Switch checked={speechNormalization} onCheckedChange={setSpeechNormalization} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Reminder Interval (sec)</Label>
                <Input type="number" value={reminderFrequency} onChange={(e) => setReminderFrequency(e.target.value)} placeholder="e.g. 10" className="text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Max Reminders</Label>
                <Input type="number" value={reminderMaxCount} onChange={(e) => setReminderMaxCount(e.target.value)} placeholder="e.g. 2" className="text-sm mt-1" />
              </div>
            </div>
            {/* Pronunciation Dictionary */}
            <div className="space-y-2">
              <Label className="text-xs">Pronunciation Dictionary</Label>
              {pronunciationEntries.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={entry.word} onChange={(e) => { const entries = [...pronunciationEntries]; entries[i] = { ...entries[i], word: e.target.value }; setPronunciationEntries(entries); }} placeholder="Word" className="text-xs h-7 flex-1" />
                  <Input value={entry.pronunciation} onChange={(e) => { const entries = [...pronunciationEntries]; entries[i] = { ...entries[i], pronunciation: e.target.value }; setPronunciationEntries(entries); }} placeholder="IPA pronunciation" className="text-xs font-mono h-7 flex-1" />
                  <button onClick={() => setPronunciationEntries((prev) => prev.filter((_, idx) => idx !== i))} className="text-[#6b7280] hover:text-red-600">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setPronunciationEntries((prev) => [...prev, { word: "", pronunciation: "" }])} className="gap-1 h-7 text-xs">
                <Plus className="h-3 w-3" /> Add Entry
              </Button>
            </div>
          </AgentConfigCollapsiblePanel>

          {/* 3. Realtime Transcription */}
          <AgentConfigCollapsiblePanel openPanels={openPanels} togglePanel={togglePanel} id="transcription" title="Realtime Transcription">
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">Denoising Mode</Label>
              <Select value={denoisingMode} onValueChange={setDenoisingMode}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="noise-cancellation">Noise Cancellation</SelectItem>
                  <SelectItem value="noise-and-background-speech-cancellation">Noise + Background Speech</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">Transcription Mode</Label>
              <Select value={transcriptionMode} onValueChange={setTranscriptionMode}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fast">Fast</SelectItem>
                  <SelectItem value="accurate">Accurate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">Vocabulary Specialization</Label>
              <Input value={vocabulary} onChange={(e) => setVocabulary(e.target.value)} placeholder="Custom vocabulary words (comma separated)" className="text-sm" />
            </div>
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">Boosted Keywords</Label>
              <Input value={boostedKeywords} onChange={(e) => setBoostedKeywords(e.target.value)} placeholder="Keywords to boost (comma separated)" className="text-sm" />
            </div>
          </AgentConfigCollapsiblePanel>

          {/* 4. Call Settings */}
          <AgentConfigCollapsiblePanel openPanels={openPanels} togglePanel={togglePanel} id="call" title="Call Settings">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#111827]">Voicemail Detection</Label>
              <Switch checked={voicemailDetection} onCheckedChange={setVoicemailDetection} />
            </div>
            {voicemailDetection && (
              <div className="space-y-2 pl-3 border-l-2 border-blue-200 ml-1">
                <div>
                  <Label className="text-xs">Action on Voicemail</Label>
                  <Select value={voicemailAction} onValueChange={setVoicemailAction}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hangup">Hang Up</SelectItem>
                      <SelectItem value="prompt">Leave Message (AI)</SelectItem>
                      <SelectItem value="static_text">Leave Message (Static)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {voicemailAction !== "hangup" && (
                  <Textarea value={voicemailText} onChange={(e) => setVoicemailText(e.target.value)} placeholder={voicemailAction === "prompt" ? "Prompt for the AI to generate a voicemail..." : "Static voicemail message..."} rows={2} className="text-sm" />
                )}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#111827]">Keypad Input (DTMF)</Label>
              <Switch checked={keypadInput} onCheckedChange={setKeypadInput} />
            </div>
            {keypadInput && (
              <div className="grid grid-cols-3 gap-2 pl-3 border-l-2 border-blue-200 ml-1">
                <div>
                  <Label className="text-xs">Digit Limit</Label>
                  <Input type="number" value={dtmfDigitLimit} onChange={(e) => setDtmfDigitLimit(e.target.value)} placeholder="e.g. 4" className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">End Key</Label>
                  <Input value={dtmfTerminationKey} onChange={(e) => setDtmfTerminationKey(e.target.value)} placeholder="#" className="text-sm mt-1" maxLength={1} />
                </div>
                <div>
                  <Label className="text-xs">Timeout (ms)</Label>
                  <Input type="number" value={dtmfTimeout} onChange={(e) => setDtmfTimeout(e.target.value)} placeholder="5000" className="text-sm mt-1" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-[#111827] mb-1.5 block">Silence Timeout (s)</Label>
                <Input type="number" value={silenceTimeout} onChange={(e) => setSilenceTimeout(e.target.value)} className="text-sm" />
              </div>
              <div>
                <Label className="text-sm text-[#111827] mb-1.5 block">Max Duration (s)</Label>
                <Input type="number" value={maxDuration} onChange={(e) => setMaxDuration(e.target.value)} className="text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-[#111827] mb-1.5 block">Pause Before Speaking (s)</Label>
                <Input type="number" value={pauseBeforeSpeaking} onChange={(e) => setPauseBeforeSpeaking(e.target.value)} step="0.1" className="text-sm" />
              </div>
              <div>
                <Label className="text-sm text-[#111827] mb-1.5 block">Ring Duration (s)</Label>
                <Input type="number" value={ringDuration} onChange={(e) => setRingDuration(e.target.value)} className="text-sm" />
              </div>
            </div>
          </AgentConfigCollapsiblePanel>

          {/* 5. Advanced LLM Settings */}
          <AgentConfigCollapsiblePanel openPanels={openPanels} togglePanel={togglePanel} id="advancedLlm" title="Advanced LLM Settings">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm text-[#111827]">High Priority Model</Label>
                <p className="text-xs text-[#6b7280]">Prioritize this agent for lower latency.</p>
              </div>
              <Switch checked={modelHighPriority} onCheckedChange={setModelHighPriority} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm text-[#111827]">Strict Tool Call Mode</Label>
                <p className="text-xs text-[#6b7280]">LLM must use exact tool schemas.</p>
              </div>
              <Switch checked={toolCallStrictMode} onCheckedChange={setToolCallStrictMode} />
            </div>
          </AgentConfigCollapsiblePanel>

          {/* 6. Knowledge Base Config */}
          <AgentConfigCollapsiblePanel openPanels={openPanels} togglePanel={togglePanel} id="kbConfig" title="Knowledge Base Config">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm text-[#111827]">Top K (chunks)</Label>
                <span className="text-xs text-[#6b7280] font-mono">{kbTopK}</span>
              </div>
              <Slider value={[parseInt(kbTopK) || 5]} onValueChange={([v]) => setKbTopK(String(v))} min={1} max={20} step={1} />
              <p className="text-xs text-[#6b7280] mt-1">Max knowledge base chunks per query.</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm text-[#111827]">Filter Score</Label>
                <span className="text-xs text-[#6b7280] font-mono">{parseFloat(kbFilterScore).toFixed(2)}</span>
              </div>
              <Slider value={[parseFloat(kbFilterScore) || 0.7]} onValueChange={([v]) => setKbFilterScore(String(v))} min={0} max={1} step={0.05} />
              <p className="text-xs text-[#6b7280] mt-1">Minimum similarity score to include a chunk.</p>
            </div>
          </AgentConfigCollapsiblePanel>

          {/* 7. Post Call Analysis */}
          <AgentConfigCollapsiblePanel openPanels={openPanels} togglePanel={togglePanel} id="postCall" title="Post Call Analysis">
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">Analysis Model</Label>
              <Select value={postCallModel} onValueChange={setPostCallModel}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
                  <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                  <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                  <SelectItem value="claude-4.5-sonnet">Claude 4.5 Sonnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">Analysis Data Configuration</Label>
              <Textarea
                value={analysisDataConfig}
                onChange={(e) => setAnalysisDataConfig(e.target.value)}
                rows={6}
                placeholder='Define analysis schema as JSON...'
                className="font-mono text-sm resize-y"
              />
            </div>
          </AgentConfigCollapsiblePanel>

          {/* 8. Security & Privacy */}
          <AgentConfigCollapsiblePanel openPanels={openPanels} togglePanel={togglePanel} id="security" title="Security & Privacy">
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">Data Storage</Label>
              <Select value={dataStorage} onValueChange={setDataStorage}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="everything">Everything</SelectItem>
                  <SelectItem value="everything_except_pii">Everything Except PII</SelectItem>
                  <SelectItem value="basic_attributes_only">Basic Attributes Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#111827]">PII Redaction</Label>
              <Switch checked={piiRedaction} onCheckedChange={(v) => { setPiiRedaction(v); if (!v) setPiiCategories([]); }} />
            </div>
            {piiRedaction && (
              <div className="space-y-2 pl-3 border-l-2 border-blue-200 ml-1">
                <Label className="text-xs">PII Categories</Label>
                <p className="text-[10px] text-[#6b7280]">Select categories to redact. Leave empty to redact all.</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PII_CATEGORIES.map((cat) => (
                    <label key={cat.key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <Checkbox
                        checked={piiCategories.includes(cat.key)}
                        onCheckedChange={(checked) => setPiiCategories((prev) => checked ? [...prev, cat.key] : prev.filter((c) => c !== cat.key))}
                        className="h-3.5 w-3.5"
                      />
                      {cat.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#111827]">Secure URLs</Label>
              <Switch checked={secureUrls} onCheckedChange={setSecureUrls} />
            </div>
            {secureUrls && (
              <div className="pl-3 border-l-2 border-blue-200 ml-1">
                <Label className="text-xs">URL Expiration (hours)</Label>
                <Input type="number" value={signedUrlExpiration} onChange={(e) => setSignedUrlExpiration(e.target.value)} min="1" max="168" className="text-sm mt-1 w-32" />
                <p className="text-[10px] text-[#6b7280] mt-1">Default: 24h. Max: 168h (7 days).</p>
              </div>
            )}
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">Fallback Voice IDs</Label>
              <Input value={fallbackVoiceIds} onChange={(e) => setFallbackVoiceIds(e.target.value)} placeholder="Comma-separated voice IDs" className="text-sm" />
            </div>
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">Default Dynamic Variables</Label>
              <Textarea value={defaultDynamicVars} onChange={(e) => setDefaultDynamicVars(e.target.value)} rows={3} placeholder='{"company_name": "Acme"}' className="font-mono text-sm resize-y" />
            </div>
          </AgentConfigCollapsiblePanel>

          {/* 9. Webhook */}
          <AgentConfigCollapsiblePanel openPanels={openPanels} togglePanel={togglePanel} id="webhook" title="Webhook">
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">Webhook URL</Label>
              <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://your-server.com/webhook" className="text-sm font-mono" />
              <p className="text-xs text-[#6b7280] mt-1">Receives call events. Leave empty for account-level webhook.</p>
            </div>
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">Timeout (seconds)</Label>
              <Input type="number" value={webhookTimeout} onChange={(e) => setWebhookTimeout(e.target.value)} min="1" max="30" className="text-sm w-24" />
            </div>
          </AgentConfigCollapsiblePanel>

          {/* 10. MCPs */}
          <AgentConfigCollapsiblePanel openPanels={openPanels} togglePanel={togglePanel} id="mcps" title="MCPs">
            <div className="space-y-3">
              {mcpServers.length === 0 && (
                <p className="text-sm text-[#6b7280]">No MCP servers configured.</p>
              )}
              {mcpServers.map((server) => (
                <div key={server.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={server.name}
                      onChange={(e) => setMcpServers((prev) => prev.map((s) => s.id === server.id ? { ...s, name: e.target.value } : s))}
                      placeholder="Server name"
                      className="text-sm"
                    />
                    <Input
                      value={server.url}
                      onChange={(e) => setMcpServers((prev) => prev.map((s) => s.id === server.id ? { ...s, url: e.target.value } : s))}
                      placeholder="Server URL"
                      className="text-sm font-mono"
                    />
                  </div>
                  <button onClick={() => removeMcpServer(server.id)} className="text-[#6b7280] hover:text-red-600 transition-colors mt-2">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addMcpServer} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add MCP Server
              </Button>
            </div>
          </AgentConfigCollapsiblePanel>

          {/* 11. Versioning */}
          <AgentConfigCollapsiblePanel openPanels={openPanels} togglePanel={togglePanel} id="versioning" title={<span className="flex items-center gap-2">Versioning{hasUnpublishedChanges && <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-400 text-amber-600">Draft</Badge>}</span>}>
            <div className="space-y-3">
              <p className="text-sm text-[#6b7280]">
                Publishing creates a snapshot of the current agent config. New calls will use the published version.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={publishing} className="gap-1.5 w-full">
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

              <div className="pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-[#111827]">Version History</Label>
                  <Button variant="ghost" size="sm" onClick={fetchVersions} disabled={versionsLoading} className="h-6 px-2 text-xs">
                    {versionsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  </Button>
                </div>
                {versions.length === 0 ? (
                  <p className="text-sm text-[#6b7280]">
                    {versionsLoading ? "Loading..." : "Click refresh to load versions."}
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {versions.map((v) => (
                      <div key={v.version} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">v{v.version}</span>
                          {v.is_published && (
                            <Badge variant="default" className="text-[9px] h-4 px-1.5">Live</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#6b7280]">
                            {v.created_at ? new Date(v.created_at).toLocaleDateString() : "—"}
                          </span>
                          {!v.is_published && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs gap-1" disabled={restoringVersion === v.version}>
                                  {restoringVersion === v.version ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
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
            </div>
          </AgentConfigCollapsiblePanel>
        </div>
      </div>
    </div>
  );
}
