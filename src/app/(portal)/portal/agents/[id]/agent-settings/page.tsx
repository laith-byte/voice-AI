"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Copy,
  Pencil,
  ChevronDown,
  Play,
  Code,
  Save,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PrototypeCallDialog } from "@/components/agents/prototype-call-dialog";

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

  // Agent Config state -- populated from Retell API
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
  const [denoisingMode, setDenoisingMode] = useState("auto");
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
      if (!res.ok) throw new Error("Failed to fetch config");
      const data = await res.json();

      // Main fields
      setSystemPrompt(data.system_prompt ?? "");
      setModel(data.llm_model ?? "gpt-4o");
      setVoice(data.voice ?? "nova");
      setFirstMessage(data.first_message ?? "");

      // Functions
      if (Array.isArray(data.functions)) {
        setFunctions(
          data.functions.map(
            (fn: Record<string, unknown>, idx: number) => ({
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
        setDenoisingMode(rt.denoising_mode ?? "auto");
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
      toast.error("Failed to load agent configuration from Retell");
    }
  }, [agentId]);

  // Fetch both agent metadata and config on mount
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([fetchAgent(), fetchConfig()]);
      setLoading(false);
    }
    loadAll();
  }, [fetchAgent, fetchConfig]);

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
    const payload = {
      system_prompt: systemPrompt,
      llm_model: model,
      voice: voice,
      first_message: firstMessage,
      functions: functions.map((fn) => ({
        id: fn.id,
        name: fn.name,
        description: fn.description,
      })),
      speech_settings: {
        background_sound: backgroundSound,
        background_sound_volume: backgroundVolume[0],
        responsiveness: responsiveness[0],
        interruption_sensitivity: interruptionSensitivity[0],
        enable_backchanneling: backchanneling,
      },
      realtime_transcription: {
        denoising_mode: denoisingMode,
        transcription_mode: transcriptionMode,
        vocabulary_specialization: parsedVocabulary,
        boosted_keywords: parsedBoostedKeywords,
      },
      call_settings: {
        voicemail_detection: voicemailDetection,
        keypad_input_detection: keypadInput,
        end_call_after_silence: parseFloat(silenceTimeout) * 1000,
        max_call_duration: parseFloat(maxDuration) * 1000,
        pause_before_speaking: parseFloat(pauseBeforeSpeaking),
        ring_duration: parseFloat(ringDuration),
      },
      post_call_analysis: {
        model: postCallModel,
        data: parsedAnalysisData,
      },
      security_fallback: {
        data_storage_setting: dataStorage,
        pii_redaction: piiRedaction,
        secure_urls: secureUrls,
        fallback_voice_ids: parsedFallbackVoiceIds,
        default_dynamic_vars: parsedDynamicVars,
      },
      mcps: mcpServers.map((mcp) => ({
        id: mcp.id,
        name: mcp.name,
        url: mcp.url,
      })),
    };

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

      toast.success("Agent configuration published to Retell");
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
      { id: Date.now().toString(), name: "", description: "" },
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            {isEditingName ? (
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={(e) => e.key === "Enter" && setIsEditingName(false)}
                autoFocus
                className="text-2xl font-semibold h-auto py-0 px-1 border-blue-400 w-auto"
              />
            ) : (
              <h1 className="text-2xl font-semibold">{agentName}</h1>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsEditingName(!isEditingName)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground font-mono">Agent ID: {agentId}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => {
                navigator.clipboard.writeText(agentId);
                toast.success("Copied agent ID");
              }}
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPrototypeOpen(true)}>
            <Play className="w-4 h-4 mr-2" />
            Prototype
          </Button>
          <Button variant="outline">
            <Code className="w-4 h-4 mr-2" />
            Embed Code
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={handlePublish}
            disabled={publishing}
          >
            {publishing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Publish
          </Button>
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Agent Config</TabsTrigger>
          <TabsTrigger value="widget">Widget</TabsTrigger>
          <TabsTrigger value="ai-analysis">AI Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left - Main Config */}
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardContent className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Language</Label>
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
                      <Label>Model</Label>
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
                    <div className="space-y-2">
                      <Label>Voice</Label>
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
                  </div>

                  <div className="space-y-2">
                    <Label>System Prompt</Label>
                    <Textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={6}
                      className="font-mono text-sm"
                      placeholder="Enter the system prompt that defines this agent's behavior..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>First Message</Label>
                    <Textarea
                      value={firstMessage}
                      onChange={(e) => setFirstMessage(e.target.value)}
                      rows={3}
                      className="font-mono text-sm"
                      placeholder="The first message the agent says when a call starts..."
                    />
                  </div>
                </CardContent>
              </Card>

              <Button
                className="bg-blue-600 hover:bg-blue-700"
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

            {/* Right - Collapsible Sections */}
            <div className="space-y-3">
              {/* Functions */}
              <Collapsible>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">Functions</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">Configure custom functions</p>
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

              {/* Speech Settings */}
              <Collapsible>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">Speech Settings</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">Responsiveness, interruption, background sound</p>
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

              {/* Realtime Transcription */}
              <Collapsible>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">Realtime Transcription</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">Live transcription settings</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-4 pt-0 space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Denoising Mode</Label>
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
                        <Label className="text-xs">Vocabulary</Label>
                        <Input
                          value={vocabulary}
                          onChange={(e) => setVocabulary(e.target.value)}
                          placeholder="Custom vocabulary (comma separated)"
                          className="text-sm h-8"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Boosted Keywords</Label>
                        <Input
                          value={boostedKeywords}
                          onChange={(e) => setBoostedKeywords(e.target.value)}
                          placeholder="Keywords to boost (comma separated)"
                          className="text-sm h-8"
                        />
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Call Settings */}
              <Collapsible>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">Call Settings</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">Max duration, silence timeout</p>
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

              {/* Post Call Analysis */}
              <Collapsible>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">Post Call Analysis</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">After-call processing</p>
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
                        <Label className="text-xs">Analysis Data Configuration</Label>
                        <Textarea
                          value={analysisDataConfig}
                          onChange={(e) => setAnalysisDataConfig(e.target.value)}
                          rows={4}
                          placeholder='JSON schema, e.g.:&#10;{"sentiment": "positive | negative | neutral"}'
                          className="font-mono text-xs resize-y"
                        />
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Security Fallback */}
              <Collapsible>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">Security Fallback</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">Fallback behavior on errors</p>
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
                      <div className="space-y-2">
                        <Label className="text-xs">Fallback Voice IDs</Label>
                        <Input
                          value={fallbackVoiceIds}
                          onChange={(e) => setFallbackVoiceIds(e.target.value)}
                          placeholder="Comma-separated voice IDs"
                          className="text-sm h-8"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Default Dynamic Variables</Label>
                        <Textarea
                          value={defaultDynamicVars}
                          onChange={(e) => setDefaultDynamicVars(e.target.value)}
                          rows={3}
                          placeholder='JSON, e.g.: {"company": "Acme"}'
                          className="font-mono text-xs resize-y"
                        />
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* MCPs */}
              <Collapsible>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">MCPs</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">Model Context Protocols</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-4 pt-0 space-y-3">
                      {mcpServers.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No MCP servers configured.
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
                              placeholder="Server URL"
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
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="widget" className="mt-6">
          <p className="text-muted-foreground">
            Configure widget settings from the dedicated Widget page.
          </p>
        </TabsContent>

        <TabsContent value="ai-analysis" className="mt-6">
          <p className="text-muted-foreground">
            Configure AI analysis from the dedicated AI Analysis page.
          </p>
        </TabsContent>
      </Tabs>

      <PrototypeCallDialog
        agentId={agentId}
        agentName={agentName || "Agent"}
        open={prototypeOpen}
        onOpenChange={setPrototypeOpen}
      />
    </div>
  );
}
