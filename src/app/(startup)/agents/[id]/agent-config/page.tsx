"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
}

export default function AgentConfigPage() {
  const { id: agentId } = useParams<{ id: string }>();

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Main editor state
  const [systemPrompt, setSystemPrompt] = useState("");
  const [llmModel, setLlmModel] = useState("gpt-4o");
  const [voice, setVoice] = useState("Hailey");
  const [firstMessage, setFirstMessage] = useState("");

  // Collapsible panel states
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({
    functions: false,
    speech: false,
    transcription: false,
    call: false,
    postCall: false,
    security: false,
    mcps: false,
  });

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

  // Fetch config from API
  const fetchConfig = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/config`);
      if (!res.ok) throw new Error("Failed to fetch config");
      const data = await res.json();

      // Main fields
      setSystemPrompt(data.system_prompt ?? "");
      setLlmModel(data.llm_model ?? "gpt-4o");
      setVoice(data.voice ?? "Hailey");
      setFirstMessage(data.first_message ?? "");

      // Functions — map Retell tool objects to {id, name, description}
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
        // vocabulary_specialization may be an array — join for display
        if (Array.isArray(rt.vocabulary_specialization)) {
          setVocabulary(rt.vocabulary_specialization.join(", "));
        } else {
          setVocabulary(rt.vocabulary_specialization ?? "");
        }
        // boosted_keywords may be an array — join for display
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
        // data may be an object — JSON.stringify for display
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
        // fallback_voice_ids may be an array — join for display
        if (Array.isArray(sf.fallback_voice_ids)) {
          setFallbackVoiceIds(sf.fallback_voice_ids.join(", "));
        } else {
          setFallbackVoiceIds(sf.fallback_voice_ids ?? "");
        }
        // default_dynamic_vars may be an object — JSON.stringify for display
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

      // MCPs — map server objects to {id, name, url}
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

  // Fetch on mount
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Save config to API
  async function handleSave() {
    if (!agentId) return;
    setSaving(true);

    // Parse boostedKeywords and vocabulary back to arrays
    const parsedBoostedKeywords = boostedKeywords
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedVocabulary = vocabulary
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Parse fallback voice IDs back to array
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
        setSaving(false);
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
        setSaving(false);
        return;
      }
    }

    // Build the full config payload matching the API structure
    const payload = {
      system_prompt: systemPrompt,
      llm_model: llmModel,
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
        // Convert seconds back to milliseconds for the API
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
        throw new Error(errData?.error ?? "Failed to save config");
      }

      toast.success("Agent configuration saved successfully");
    } catch (err) {
      console.error("Failed to save agent config:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to save configuration"
      );
    } finally {
      setSaving(false);
    }
  }

  function togglePanel(panel: string) {
    setOpenPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  }

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

  function CollapsiblePanel({
    id,
    title,
    children,
  }: {
    id: string;
    title: string;
    children: React.ReactNode;
  }) {
    const isOpen = openPanels[id];
    return (
      <Collapsible open={isOpen} onOpenChange={() => togglePanel(id)}>
        <div className="border border-[#e5e7eb] rounded-lg">
          <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-50 transition-colors">
            <span className="text-sm font-medium text-[#111827]">{title}</span>
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

  // Show loading spinner while initially fetching
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

          {/* LLM Model */}
          <div>
            <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
              LLM Model
            </Label>
            <Select value={llmModel} onValueChange={setLlmModel}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
                <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
                <SelectItem value="claude-3.5-sonnet">
                  claude-3.5-sonnet
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Voice */}
          <div>
            <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
              Voice
            </Label>
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
        </div>

        {/* RIGHT SIDE - Collapsible Panels */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[#111827]">
            Advanced Settings
          </h2>

          {/* 1. Functions */}
          <CollapsiblePanel id="functions" title="Functions">
            <div className="space-y-3">
              {functions.map((fn) => (
                <div
                  key={fn.id}
                  className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg"
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
                      className="text-sm font-mono"
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
                      className="text-sm"
                    />
                  </div>
                  <button
                    onClick={() => removeFunction(fn.id)}
                    className="text-[#6b7280] hover:text-red-600 transition-colors mt-2"
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
            </div>
          </CollapsiblePanel>

          {/* 2. Speech Settings */}
          <CollapsiblePanel id="speech" title="Speech Settings">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm text-[#111827]">Responsiveness</Label>
                <span className="text-xs text-[#6b7280] font-mono">
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
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm text-[#111827]">
                  Interruption Sensitivity
                </Label>
                <span className="text-xs text-[#6b7280] font-mono">
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
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">
                Background Sound
              </Label>
              <Select
                value={backgroundSound}
                onValueChange={setBackgroundSound}
              >
                <SelectTrigger className="w-full">
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
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-[#111827]">
                    Background Volume
                  </Label>
                  <span className="text-xs text-[#6b7280] font-mono">
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
              <Label className="text-sm text-[#111827]">Backchanneling</Label>
              <Switch
                checked={backchanneling}
                onCheckedChange={setBackchanneling}
              />
            </div>
          </CollapsiblePanel>

          {/* 3. Realtime Transcription */}
          <CollapsiblePanel id="transcription" title="Realtime Transcription">
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">
                Denoising Mode
              </Label>
              <Select
                value={denoisingMode}
                onValueChange={setDenoisingMode}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                  <SelectItem value="off">Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">
                Transcription Mode
              </Label>
              <Select
                value={transcriptionMode}
                onValueChange={setTranscriptionMode}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="medical">Medical</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">
                Vocabulary
              </Label>
              <Input
                value={vocabulary}
                onChange={(e) => setVocabulary(e.target.value)}
                placeholder="Custom vocabulary words (comma separated)"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">
                Boosted Keywords
              </Label>
              <Input
                value={boostedKeywords}
                onChange={(e) => setBoostedKeywords(e.target.value)}
                placeholder="Keywords to boost in transcription (comma separated)"
                className="text-sm"
              />
            </div>
          </CollapsiblePanel>

          {/* 4. Call Settings */}
          <CollapsiblePanel id="call" title="Call Settings">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#111827]">
                Voicemail Detection
              </Label>
              <Switch
                checked={voicemailDetection}
                onCheckedChange={setVoicemailDetection}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#111827]">Keypad Input</Label>
              <Switch
                checked={keypadInput}
                onCheckedChange={setKeypadInput}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-[#111827] mb-1.5 block">
                  Silence Timeout (s)
                </Label>
                <Input
                  type="number"
                  value={silenceTimeout}
                  onChange={(e) => setSilenceTimeout(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-sm text-[#111827] mb-1.5 block">
                  Max Duration (s)
                </Label>
                <Input
                  type="number"
                  value={maxDuration}
                  onChange={(e) => setMaxDuration(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-[#111827] mb-1.5 block">
                  Pause Before Speaking (s)
                </Label>
                <Input
                  type="number"
                  value={pauseBeforeSpeaking}
                  onChange={(e) => setPauseBeforeSpeaking(e.target.value)}
                  step="0.1"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-sm text-[#111827] mb-1.5 block">
                  Ring Duration (s)
                </Label>
                <Input
                  type="number"
                  value={ringDuration}
                  onChange={(e) => setRingDuration(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </CollapsiblePanel>

          {/* 5. Post Call Analysis */}
          <CollapsiblePanel id="postCall" title="Post Call Analysis">
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">
                Analysis Model
              </Label>
              <Select
                value={postCallModel}
                onValueChange={setPostCallModel}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
                  <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                  <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
                  <SelectItem value="claude-3.5-sonnet">
                    claude-3.5-sonnet
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">
                Analysis Data Configuration
              </Label>
              <Textarea
                value={analysisDataConfig}
                onChange={(e) => setAnalysisDataConfig(e.target.value)}
                rows={6}
                placeholder='Define analysis schema as JSON, e.g.:\n{\n  "sentiment": "positive | negative | neutral",\n  "intent": "string"\n}'
                className="font-mono text-sm resize-y"
              />
            </div>
          </CollapsiblePanel>

          {/* 6. Security Fallback */}
          <CollapsiblePanel id="security" title="Security Fallback">
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">
                Data Storage
              </Label>
              <Select value={dataStorage} onValueChange={setDataStorage}>
                <SelectTrigger className="w-full">
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
              <Label className="text-sm text-[#111827]">PII Redaction</Label>
              <Switch
                checked={piiRedaction}
                onCheckedChange={setPiiRedaction}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#111827]">Secure URLs</Label>
              <Switch
                checked={secureUrls}
                onCheckedChange={setSecureUrls}
              />
            </div>
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">
                Fallback Voice IDs
              </Label>
              <Input
                value={fallbackVoiceIds}
                onChange={(e) => setFallbackVoiceIds(e.target.value)}
                placeholder="Comma-separated voice IDs for fallback"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-sm text-[#111827] mb-1.5 block">
                Default Dynamic Variables
              </Label>
              <Textarea
                value={defaultDynamicVars}
                onChange={(e) => setDefaultDynamicVars(e.target.value)}
                rows={3}
                placeholder='JSON key-value pairs, e.g.:\n{"company_name": "Acme", "timezone": "PST"}'
                className="font-mono text-sm resize-y"
              />
            </div>
          </CollapsiblePanel>

          {/* 7. MCPs */}
          <CollapsiblePanel id="mcps" title="MCPs">
            <div className="space-y-3">
              {mcpServers.length === 0 && (
                <p className="text-sm text-[#6b7280]">
                  No MCP servers configured. Add one to enable external tool
                  integrations.
                </p>
              )}
              {mcpServers.map((server) => (
                <div
                  key={server.id}
                  className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg"
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
                      className="text-sm"
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
                      className="text-sm font-mono"
                    />
                  </div>
                  <button
                    onClick={() => removeMcpServer(server.id)}
                    className="text-[#6b7280] hover:text-red-600 transition-colors mt-2"
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
            </div>
          </CollapsiblePanel>
        </div>
      </div>
    </div>
  );
}
