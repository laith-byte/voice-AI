"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Shield,
  Plug,
  Sparkles,
  Check,
  RotateCcw,
  Palette,
  MessageSquareText,
  Clock,
  Info,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PrototypeCallDialog } from "@/components/agents/prototype-call-dialog";
import { useRetellCall } from "@/hooks/use-retell-call";
import { useDashboardTheme } from "@/components/portal/dashboard-theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
  [key: string]: unknown;
}

export default function AgentSettingsPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentName, setAgentName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const isChat = agent?.platform === "retell-chat";

  // Agent Config state -- populated from Retell API
  const [llmId, setLlmId] = useState<string | null>(null);
  const [language, setLanguage] = useState("en");
  const [model, setModel] = useState("gpt-4o");
  const [voice, setVoice] = useState("nova");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [firstMessage, setFirstMessage] = useState("");

  // Functions state
  const [functions, setFunctions] = useState<FunctionTool[]>([]);

  // Speech settings state
  const [responsiveness, setResponsiveness] = useState([0.5]);
  const [interruptionSensitivity, setInterruptionSensitivity] = useState([0.5]);
  const [backgroundSound, setBackgroundSound] = useState("off");
  const [backgroundVolume, setBackgroundVolume] = useState([0.5]);
  const [backchanneling, setBackchanneling] = useState(false);

  // Transcription state
  const [denoisingMode, setDenoisingMode] = useState("aggressive");
  const [transcriptionMode, setTranscriptionMode] = useState("default");
  const [vocabulary, setVocabulary] = useState("");
  const [boostedKeywords, setBoostedKeywords] = useState("");

  // Call settings state
  const [voicemailDetection, setVoicemailDetection] = useState(false);
  const [keypadInput, setKeypadInput] = useState(false);
  const [silenceTimeout, setSilenceTimeout] = useState("30");
  const [maxDuration, setMaxDuration] = useState("3600");
  const [pauseBeforeSpeaking, setPauseBeforeSpeaking] = useState("0.4");
  const [ringDuration, setRingDuration] = useState("15");

  // Post call analysis state
  const [postCallModel, setPostCallModel] = useState("gpt-4o");
  const [analysisDataConfig, setAnalysisDataConfig] = useState("");

  // Security fallback state
  const [dataStorage, setDataStorage] = useState("cloud");
  const [piiRedaction, setPiiRedaction] = useState(false);
  const [secureUrls, setSecureUrls] = useState(false);
  const [fallbackVoiceIds, setFallbackVoiceIds] = useState("");
  const [defaultDynamicVars, setDefaultDynamicVars] = useState("");

  // MCPs state
  const [mcpServers, setMcpServers] = useState<
    { id: string; name: string; url: string }[]
  >([]);
  const [prototypeOpen, setPrototypeOpen] = useState(false);

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
  const { color: dashboardColor, setColor: setDashboardColor, saveColor } = useDashboardTheme();
  const { isCallActive, isAgentTalking, isMuted, transcript, startCall, stopCall, toggleMute } = useRetellCall();
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

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

  const colorPresets = [
    { name: "Blue", value: "#2563eb" },
    { name: "Indigo", value: "#4f46e5" },
    { name: "Violet", value: "#7c3aed" },
    { name: "Emerald", value: "#059669" },
    { name: "Rose", value: "#e11d48" },
    { name: "Orange", value: "#ea580c" },
    { name: "Slate", value: "#475569" },
  ];

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
      setModel(data.llm_model ?? "gpt-4o");
      setVoice(data.voice ?? "nova");
      setFirstMessage(data.first_message ?? "");

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
      }

      // Realtime transcription
      const rt = data.realtime_transcription;
      if (rt) {
        setDenoisingMode(rt.denoising_mode ?? "aggressive");
        setTranscriptionMode(rt.transcription_mode ?? "default");
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

      // Call settings
      const cs = data.call_settings;
      if (cs) {
        setVoicemailDetection(cs.voicemail_detection ?? false);
        setKeypadInput(cs.keypad_input_detection ?? false);
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
          cs.pause_before_speaking != null
            ? String(cs.pause_before_speaking)
            : "0.4"
        );
        setRingDuration(
          cs.ring_duration != null ? String(cs.ring_duration) : "15"
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
        setDataStorage(sf.data_storage_setting ?? "cloud");
        setPiiRedaction(sf.pii_redaction ?? false);
        setSecureUrls(sf.secure_urls ?? false);
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
    }
  }, [agentId]);

  // Fetch widget config
  const fetchWidgetConfig = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("widget_config")
      .select("*")
      .eq("agent_id", agentId)
      .single();

    if (data) {
      setWidgetConfigId(data.id);
      setWidgetDescription(data.description ?? "Our assistant is here to help.");
    } else {
      const { data: newConfig } = await supabase
        .from("widget_config")
        .insert({ agent_id: agentId })
        .select()
        .single();
      if (newConfig) setWidgetConfigId(newConfig.id);
    }
  }, [agentId]);

  // Fetch AI analysis config
  const fetchAiConfig = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ai_analysis_config")
      .select("*")
      .eq("agent_id", agentId)
      .single();

    let config = data;
    if (!config || error) {
      const { data: newConfig } = await supabase
        .from("ai_analysis_config")
        .insert({ agent_id: agentId })
        .select()
        .single();
      config = newConfig;
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
      await Promise.all([fetchAgent(), fetchConfig(), fetchWidgetConfig(), fetchAiConfig()]);
      setLoading(false);
    }
    loadAll();
  }, [fetchAgent, fetchConfig, fetchWidgetConfig, fetchAiConfig]);

  // Widget save
  const handleWidgetSave = async () => {
    setWidgetSaving(true);
    const supabase = createClient();
    await supabase
      .from("widget_config")
      .upsert({
        ...(widgetConfigId ? { id: widgetConfigId } : {}),
        agent_id: agentId,
        description: widgetDescription,
      });
    await saveColor(dashboardColor);
    toast.success("Widget & dashboard color saved");
    setWidgetSaving(false);
  };

  // AI Analysis save
  const handleAiSave = async () => {
    setAiSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("ai_analysis_config")
      .update({
        summary_enabled: summaryEnabled,
        summary_custom_prompt: summaryPrompt,
        evaluation_enabled: evaluationEnabled,
        evaluation_custom_prompt: evaluationPrompt,
        auto_tagging_enabled: autoTaggingEnabled,
        auto_tagging_mode: autoTaggingMode,
        auto_tagging_custom_prompt: autoTaggingPrompt,
        misunderstood_queries_enabled: misunderstoodEnabled,
      })
      .eq("id", aiConfigId!);

    if (error) {
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

  // Save agent name to Supabase
  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("agents")
      .update({ name: agentName })
      .eq("id", agentId);

    if (error) {
      toast.error("Failed to save changes");
    } else {
      toast.success("Changes saved");
      setAgent((prev) => (prev ? { ...prev, name: agentName } : prev));
    }
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
    const parsedVocabulary = vocabulary
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

    // Parse post call analysis data from JSON string
    let parsedAnalysisData: unknown | undefined;
    if (analysisDataConfig.trim()) {
      try {
        parsedAnalysisData = JSON.parse(analysisDataConfig);
      } catch {
        toast.error(
          "Invalid JSON in Analysis Data Configuration. Please fix and try again."
        );
        setPublishing(false);
        return;
      }
    }

    // Build full config payload matching the API structure
    const payload: Record<string, unknown> = {
      ...(llmId && { llm_id: llmId }),
      system_prompt: systemPrompt,
      llm_model: model,
      first_message: firstMessage,
      functions: functions.map(({ id, name, description, ...rest }) => ({
        ...rest,
        id,
        name,
        description,
      })),
      post_call_analysis: {
        model: postCallModel,
        data: parsedAnalysisData,
      },
      security_fallback: {
        data_storage_setting: dataStorage,
        pii_redaction: piiRedaction,
        secure_urls: secureUrls,
        ...(isChat ? {} : { fallback_voice_ids: parsedFallbackVoiceIds }),
        default_dynamic_vars: parsedDynamicVars,
      },
      mcps: mcpServers.map((mcp) => ({
        id: mcp.id,
        name: mcp.name,
        url: mcp.url,
      })),
    };

    // Voice-only settings
    if (!isChat) {
      payload.voice = voice;
      payload.speech_settings = {
        background_sound: backgroundSound,
        background_sound_volume: backgroundVolume[0],
        responsiveness: responsiveness[0],
        interruption_sensitivity: interruptionSensitivity[0],
        enable_backchanneling: backchanneling,
      };
      payload.realtime_transcription = {
        denoising_mode: denoisingMode,
        transcription_mode: transcriptionMode,
        vocabulary_specialization: parsedVocabulary,
        boosted_keywords: parsedBoostedKeywords,
      };
      payload.call_settings = {
        voicemail_detection: voicemailDetection,
        keypad_input_detection: keypadInput,
        end_call_after_silence: parseFloat(silenceTimeout) * 1000,
        max_call_duration: parseFloat(maxDuration) * 1000,
        pause_before_speaking: parseFloat(pauseBeforeSpeaking),
        ring_duration: parseFloat(ringDuration),
      };
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
    } catch (err) {
      console.error("Failed to publish agent config:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to publish configuration"
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
  };

  function addFunction() {
    setFunctions((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", description: "", type: "custom" },
    ]);
  }

  function removeFunction(id: string) {
    setFunctions((prev) => prev.filter((f) => f.id !== id));
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
                <Badge variant="outline" className="ml-1 text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 inline-block" />
                  Active
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
            <Button variant="outline" onClick={() => setPrototypeOpen(true)} className="bg-white/80 dark:bg-background hover:bg-white dark:hover:bg-accent">
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

        <TabsContent value="config" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left - Main Config */}
            <div className="lg:col-span-2 space-y-6">
              {/* Core Settings Card */}
              <Card className="overflow-hidden animate-fade-in-up stagger-1 glass-card rounded-xl">
                <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-6 py-4 border-b">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 dark:bg-primary/10 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-primary dark:text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Core Configuration</h3>
                      <p className="text-xs text-muted-foreground">
                        {isChat ? "Language, model, and behavior" : "Language, model, voice, and behavior"}
                      </p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-6 space-y-5">
                  <div className={`grid grid-cols-1 ${isChat ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-4`}>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs font-medium">
                        <Languages className="w-3.5 h-3.5 text-muted-foreground" />
                        Language
                      </Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="ar">Arabic</SelectItem>
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
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                          <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                          <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                          <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {!isChat && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5 text-xs font-medium">
                          <AudioLines className="w-3.5 h-3.5 text-muted-foreground" />
                          Voice
                        </Label>
                        <Select value={voice} onValueChange={setVoice}>
                          <SelectTrigger>
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
                    )}
                  </div>

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

            {/* Right - Collapsible Sections */}
            <div className="space-y-3">
              {/* Functions */}
              <Collapsible>
                <Card className="overflow-hidden animate-fade-in-up stagger-2 glass-card rounded-xl">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-md bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                            <Zap className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                          </div>
                          <div>
                            <CardTitle className="text-sm">Functions</CardTitle>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Custom actions & integrations</p>
                          </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-4 pt-0 space-y-3">
                      {functions.map((fn) => (
                        <div
                          key={fn.id}
                          className="flex items-start gap-2 p-3 bg-accent/30 rounded-lg"
                        >
                          <div className="flex-1 space-y-2">
                            <Input
                              value={fn.name}
                              onChange={(e) =>
                                setFunctions((prev) =>
                                  prev.map((f) =>
                                    f.id === fn.id
                                      ? { ...f, name: e.target.value }
                                      : f
                                  )
                                )
                              }
                              placeholder="Function name"
                              className="text-sm font-mono h-8"
                            />
                            <Input
                              value={fn.description}
                              onChange={(e) =>
                                setFunctions((prev) =>
                                  prev.map((f) =>
                                    f.id === fn.id
                                      ? { ...f, description: e.target.value }
                                      : f
                                  )
                                )
                              }
                              placeholder="Description"
                              className="text-sm h-8"
                            />
                          </div>
                          <button
                            onClick={() => removeFunction(fn.id)}
                            className="text-muted-foreground hover:text-red-600 transition-colors mt-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addFunction}
                        className="gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Function
                      </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Speech Settings - voice agents only */}
              {!isChat && (
                <Collapsible>
                  <Card className="overflow-hidden animate-fade-in-up stagger-3 glass-card rounded-xl">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-md bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                              <AudioLines className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                              <CardTitle className="text-sm">Speech Settings</CardTitle>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Voice behavior & background audio</p>
                            </div>
                          </div>
                          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="p-4 pt-0 space-y-3">
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
                              <SelectItem value="office">Office</SelectItem>
                              <SelectItem value="cafe">Cafe</SelectItem>
                              <SelectItem value="restaurant">Restaurant</SelectItem>
                              <SelectItem value="nature">Nature</SelectItem>
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
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {/* Realtime Transcription - voice agents only */}
              {!isChat && (
                <Collapsible>
                  <Card className="overflow-hidden animate-fade-in-up stagger-4 glass-card rounded-xl">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-md bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center">
                              <Mic className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            </div>
                            <div>
                              <CardTitle className="text-sm">Transcription</CardTitle>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Live speech-to-text settings</p>
                            </div>
                          </div>
                          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="p-4 pt-0 space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Noise Reduction</Label>
                          <Select
                            value={denoisingMode}
                            onValueChange={setDenoisingMode}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto</SelectItem>
                              <SelectItem value="aggressive">Aggressive</SelectItem>
                              <SelectItem value="off">Off</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Transcription Mode</Label>
                          <Select
                            value={transcriptionMode}
                            onValueChange={setTranscriptionMode}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Default</SelectItem>
                              <SelectItem value="medical">Medical</SelectItem>
                              <SelectItem value="legal">Legal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Custom Vocabulary</Label>
                          <Input
                            value={vocabulary}
                            onChange={(e) => setVocabulary(e.target.value)}
                            placeholder="e.g. product names, terms"
                            className="text-sm h-8"
                          />
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
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {/* Call Settings - voice agents only */}
              {!isChat && (
                <Collapsible>
                  <Card className="overflow-hidden animate-fade-in-up stagger-5 glass-card rounded-xl">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-md bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                              <Phone className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                              <CardTitle className="text-sm">Call Settings</CardTitle>
                              <p className="text-[11px] text-muted-foreground mt-0.5">Duration, timeouts & detection</p>
                            </div>
                          </div>
                          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="p-4 pt-0 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Voicemail Detection</Label>
                          <Switch
                            checked={voicemailDetection}
                            onCheckedChange={setVoicemailDetection}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Keypad Input</Label>
                          <Switch
                            checked={keypadInput}
                            onCheckedChange={setKeypadInput}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs">Silence Timeout (s)</Label>
                            <Input
                              type="number"
                              value={silenceTimeout}
                              onChange={(e) => setSilenceTimeout(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Max Duration (s)</Label>
                            <Input
                              type="number"
                              value={maxDuration}
                              onChange={(e) => setMaxDuration(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs">Pause Before Speaking (s)</Label>
                            <Input
                              type="number"
                              value={pauseBeforeSpeaking}
                              onChange={(e) => setPauseBeforeSpeaking(e.target.value)}
                              step="0.1"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Ring Duration (s)</Label>
                            <Input
                              type="number"
                              value={ringDuration}
                              onChange={(e) => setRingDuration(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {/* Post Call/Chat Analysis */}
              <Collapsible>
                <Card className="overflow-hidden animate-fade-in-up stagger-6 glass-card rounded-xl">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-md bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center">
                            <BrainCircuit className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                          </div>
                          <div>
                            <CardTitle className="text-sm">{isChat ? "Post Chat Analysis" : "Post Call Analysis"}</CardTitle>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{isChat ? "AI-powered chat insights" : "AI-powered call insights"}</p>
                          </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-4 pt-0 space-y-3">
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
                            <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                            <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                            <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Analysis Schema</Label>
                        <Textarea
                          value={analysisDataConfig}
                          onChange={(e) => setAnalysisDataConfig(e.target.value)}
                          rows={4}
                          placeholder='e.g.: {"sentiment": "positive | negative | neutral"}'
                          className="font-mono text-xs resize-y"
                        />
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Security & Privacy */}
              <Collapsible>
                <Card className="overflow-hidden animate-fade-in-up stagger-6 glass-card rounded-xl">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-md bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                            <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <CardTitle className="text-sm">Security & Privacy</CardTitle>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Data protection & fallbacks</p>
                          </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-4 pt-0 space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Data Storage</Label>
                        <Select value={dataStorage} onValueChange={setDataStorage}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cloud">Cloud</SelectItem>
                            <SelectItem value="on-premise">On-Premise</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">PII Redaction</Label>
                        <Switch
                          checked={piiRedaction}
                          onCheckedChange={setPiiRedaction}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Secure URLs</Label>
                        <Switch
                          checked={secureUrls}
                          onCheckedChange={setSecureUrls}
                        />
                      </div>
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
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Integrations */}
              <Collapsible>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-md bg-primary/10 dark:bg-primary/10 flex items-center justify-center">
                            <Plug className="w-3.5 h-3.5 text-primary dark:text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-sm">Integrations</CardTitle>
                            <p className="text-[11px] text-muted-foreground mt-0.5">External tool connections</p>
                          </div>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-4 pt-0 space-y-3">
                      {mcpServers.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No integrations configured yet.
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
                              placeholder="Integration name"
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
                        Add Integration
                      </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </div>
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

              <Card className="overflow-hidden animate-fade-in-up stagger-2 glass-card rounded-xl">
                <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                      <Palette className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Dashboard Color</h3>
                      <p className="text-[11px] text-muted-foreground">Applies to your entire portal</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setDashboardColor(preset.value)}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                          dashboardColor === preset.value
                            ? "border-foreground scale-110 shadow-md"
                            : "border-transparent"
                        )}
                        style={{ backgroundColor: preset.value }}
                        title={preset.name}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      value={dashboardColor}
                      onChange={(e) => setDashboardColor(e.target.value)}
                      className="text-xs font-mono h-8 flex-1"
                      placeholder="#2563eb"
                    />
                    <div
                      className="w-8 h-8 rounded-md border shrink-0"
                      style={{ backgroundColor: dashboardColor }}
                    />
                  </div>
                </CardContent>
              </Card>

              {!isChat && audioDevices.length > 0 && (
                <Card className="overflow-hidden animate-fade-in-up stagger-3 glass-card rounded-xl">
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
                    <Button variant="outline" size="sm">
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

      <PrototypeCallDialog
        agentId={agentId}
        agentName={agentName || "Agent"}
        open={prototypeOpen}
        onOpenChange={setPrototypeOpen}
        isChat={isChat}
        firstMessage={firstMessage}
      />
    </div>
  );
}
