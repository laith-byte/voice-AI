"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  RotateCcw,
  Save,
  Bot,
  Loader2,
  Palette,
  MessageSquareText,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useRetellCall } from "@/hooks/use-retell-call";
import { useDashboardTheme } from "@/components/portal/dashboard-theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function WidgetPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [configId, setConfigId] = useState<string | null>(null);

  // Simplified config state
  const [description, setDescription] = useState("Our assistant is here to help.");
  const { color: accentColor, setColor: setAccentColor, saveColor } = useDashboardTheme();

  // Call state
  const { isCallActive, isAgentTalking, isMuted, transcript, startCall, stopCall, toggleMute } =
    useRetellCall();
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Audio device selection
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  useEffect(() => {
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

  // Timer for call duration
  useEffect(() => {
    if (isCallActive) {
      setCallDuration(0);
      durationRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    } else {
      if (durationRef.current) {
        clearInterval(durationRef.current);
        durationRef.current = null;
      }
    }
    return () => {
      if (durationRef.current) clearInterval(durationRef.current);
    };
  }, [isCallActive]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const loadConfig = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [agentRes, configRes] = await Promise.all([
      supabase.from("agents").select("name").eq("id", agentId).single(),
      supabase.from("widget_config").select("*").eq("agent_id", agentId).single(),
    ]);

    if (agentRes.data) {
      setAgentName(agentRes.data.name ?? "");
    }

    let config = configRes.data;

    if (!config) {
      const { data: newConfig, error: insertError } = await supabase
        .from("widget_config")
        .insert({ agent_id: agentId })
        .select()
        .single();

      if (insertError) {
        toast.error("Failed to initialize widget config");
        setLoading(false);
        return;
      }
      config = newConfig;
    }

    if (config) {
      setConfigId(config.id);
      setDescription(config.description ?? "Our assistant is here to help.");
    }

    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();

    // Save widget description
    const { error } = await supabase
      .from("widget_config")
      .upsert({
        ...(configId ? { id: configId } : {}),
        agent_id: agentId,
        description,
      });

    // Save dashboard color globally for the client
    await saveColor(accentColor);

    if (error) {
      toast.error("Failed to save widget config");
    } else {
      toast.success("Settings saved — dashboard color updated globally");
    }
    setSaving(false);
  };

  async function handleStartCall() {
    setIsConnecting(true);
    await startCall(agentId, selectedDeviceId ? { captureDeviceId: selectedDeviceId } : undefined);
    setIsConnecting(false);
  }

  function handleEndCall() {
    stopCall();
  }

  function handleResetCall() {
    stopCall();
    setCallDuration(0);
    setTimeout(() => {
      handleStartCall();
    }, 500);
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="space-y-4">
            <div className="rounded-xl border p-4 space-y-3">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
            <div className="rounded-xl border p-4 space-y-3">
              <Skeleton className="h-5 w-32" />
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded-full" />
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-[500px] w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const colorPresets = [
    { name: "Blue", value: "#2563eb" },
    { name: "Indigo", value: "#4f46e5" },
    { name: "Violet", value: "#7c3aed" },
    { name: "Emerald", value: "#059669" },
    { name: "Rose", value: "#e11d48" },
    { name: "Orange", value: "#ea580c" },
    { name: "Slate", value: "#475569" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Voice Widget</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Test your agent live and customize the widget appearance
          </p>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side - Slim Config */}
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
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="text-sm"
                  placeholder="What visitors see before starting a call..."
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
                    onClick={() => setAccentColor(preset.value)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110",
                      accentColor === preset.value
                        ? "border-foreground scale-110 shadow-md ring-2 ring-offset-2 ring-foreground/20"
                        : "border-transparent hover:border-border"
                    )}
                    style={{ backgroundColor: preset.value }}
                    title={preset.name}
                  />
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="text-xs font-mono h-8 flex-1"
                  placeholder="#2563eb"
                />
                <div
                  className="w-8 h-8 rounded-md border shrink-0"
                  style={{ backgroundColor: accentColor }}
                />
              </div>
            </CardContent>
          </Card>

          {audioDevices.length > 0 && (
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
        </div>

        {/* Right Side - Live Call Widget (3 cols) */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden border-0 shadow-xl rounded-xl">
            {/* Widget Header */}
            <div
              className="px-6 py-4 text-white relative overflow-hidden"
              style={{ backgroundColor: accentColor }}
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
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          isCallActive ? "bg-green-400 animate-pulse" : "bg-white/50"
                        )}
                      />
                      <p className="text-xs text-white/80">
                        {isCallActive
                          ? isAgentTalking
                            ? "Speaking..."
                            : "Listening..."
                          : "Ready"}
                      </p>
                    </div>
                  </div>
                </div>
                {isCallActive && (
                  <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1">
                    <Clock className="w-3 h-3 text-white/80" />
                    <span className="text-xs font-mono text-white/90">
                      {formatDuration(callDuration)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Widget Body */}
            <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-background">
              {!isCallActive && transcript.length === 0 ? (
                /* Idle State */
                <div className="flex flex-col items-center justify-center py-16 px-8 gap-6">
                  <p className="text-sm text-center text-muted-foreground max-w-md">
                    {description}
                  </p>

                  {/* Call button */}
                  <div className="relative">
                    <button
                      onClick={handleStartCall}
                      disabled={isConnecting}
                      className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shadow-xl disabled:opacity-50"
                      style={{ backgroundColor: accentColor }}
                    >
                      {isConnecting ? (
                        <Loader2 className="w-8 h-8 animate-spin" />
                      ) : (
                        <Phone className="w-8 h-8" />
                      )}
                    </button>
                    {!isConnecting && (
                      <div
                        className="absolute inset-0 rounded-full animate-ping opacity-20"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {isConnecting ? "Connecting to agent..." : "Click to start a live call"}
                  </p>
                </div>
              ) : (
                /* Active / Post-call State */
                <div className="flex flex-col" style={{ minHeight: 420 }}>
                  {/* Transcript area */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3" style={{ maxHeight: 420 }}>
                    {transcript.length === 0 && isCallActive && (
                      <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center animate-pulse"
                            style={{ backgroundColor: `${accentColor}20` }}
                          >
                            <Mic className="w-5 h-5" style={{ color: accentColor }} />
                          </div>
                          <p className="text-sm">Waiting for conversation...</p>
                        </div>
                      </div>
                    )}
                    {transcript.map((entry, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex",
                          entry.role === "agent" ? "justify-start" : "justify-end"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                            entry.role === "agent"
                              ? "bg-white dark:bg-slate-800 border shadow-sm rounded-bl-md"
                              : "text-white rounded-br-md"
                          )}
                          style={
                            entry.role === "user"
                              ? { backgroundColor: accentColor }
                              : undefined
                          }
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

                  {/* Call controls bar */}
                  <div className="border-t bg-white dark:bg-slate-900 px-6 py-4">
                    <div className="flex items-center justify-center gap-3">
                      {isCallActive ? (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full w-11 h-11"
                            onClick={toggleMute}
                          >
                            {isMuted ? (
                              <MicOff className="w-4 h-4 text-red-500" />
                            ) : (
                              <Mic className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20"
                            onClick={handleEndCall}
                          >
                            <PhoneOff className="w-5 h-5 text-white" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full w-11 h-11"
                            onClick={handleResetCall}
                            title="Reset call"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        /* Post-call: offer to call again */
                        <div className="flex items-center gap-3">
                          <p className="text-sm text-muted-foreground">Call ended</p>
                          <Button
                            className="rounded-full px-6 text-white shadow-md"
                            style={{ backgroundColor: accentColor }}
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
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
