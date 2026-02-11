"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { FeatureGate } from "@/components/portal/feature-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  SlidersHorizontal,
  Download,
  Phone,
  Globe,
  Smile,
  Bookmark,
  Trash2,
  Play,
  Pause,
  LayoutGrid,
  List,
  CheckCircle2,
  XCircle,
  ArrowDownToLine,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

interface TranscriptMessage {
  role: "agent" | "user";
  content: string;
  time: string;
}

interface Conversation {
  id: string;
  callerName: string;
  callerId: string;
  timestamp: string;
  platform: "web" | "phone";
  duration: string;
  summary: string;
  evaluation: { success: boolean; criteria: string };
  reasonEnded: string;
  transcript: TranscriptMessage[];
  recordingUrl: string | null;
}

interface CallLogRow {
  id: string;
  retell_call_id: string;
  from_number: string | null;
  duration_seconds: number | null;
  status: string | null;
  summary: string | null;
  evaluation: string | null;
  transcript: unknown;
  metadata: Record<string, unknown> | null;
  started_at: string | null;
  recording_url: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function derivePlatform(fromNumber: string | null): "phone" | "web" {
  if (fromNumber && fromNumber.startsWith("+")) return "phone";
  return "web";
}

function deriveCallerName(fromNumber: string | null, metadata: Record<string, unknown> | null): string {
  if (metadata?.caller_name && typeof metadata.caller_name === "string") return metadata.caller_name;
  if (fromNumber) return fromNumber;
  return "Unknown Caller";
}

function parseTranscript(raw: unknown): TranscriptMessage[] {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw.map((entry: Record<string, unknown>, i: number) => ({
    role: (entry.role === "agent" ? "agent" : "user") as "agent" | "user",
    content: (entry.content as string) || (entry.text as string) || "",
    time: (entry.time as string) || (entry.timestamp as string) || `${Math.floor(i * 5 / 60)}:${(i * 5 % 60).toString().padStart(2, "0")}`,
  }));
}

function parseEvaluation(raw: string | null): { success: boolean; criteria: string } {
  if (!raw) return { success: false, criteria: "No evaluation available." };
  const lowerRaw = raw.toLowerCase();
  const success = lowerRaw.includes("true") || lowerRaw.includes("success") || lowerRaw.includes("passed");
  return { success, criteria: raw };
}

function mapCallLogToConversation(log: CallLogRow): Conversation {
  const metadata = log.metadata as Record<string, unknown> | null;
  const disconnectionReason =
    (metadata?.disconnection_reason as string) || log.status || "unknown";

  return {
    id: log.retell_call_id || log.id,
    callerName: deriveCallerName(log.from_number, metadata),
    callerId: log.from_number || log.retell_call_id,
    timestamp: formatTimestamp(log.started_at),
    platform: derivePlatform(log.from_number),
    duration: formatDuration(log.duration_seconds),
    summary: log.summary || "No summary available for this conversation.",
    evaluation: parseEvaluation(log.evaluation),
    reasonEnded: disconnectionReason,
    transcript: parseTranscript(log.transcript),
    recordingUrl: log.recording_url || null,
  };
}

export default function ConversationsPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [loading, setLoading] = useState(true);
  const [isChat, setIsChat] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // Check if this is a chat agent
    const { data: agentData } = await supabase
      .from("agents")
      .select("platform")
      .eq("id", agentId)
      .single();
    if (agentData?.platform === "retell-chat") {
      setIsChat(true);
    }

    const { data, error } = await supabase
      .from("call_logs")
      .select("id, retell_call_id, from_number, duration_seconds, status, summary, evaluation, transcript, metadata, started_at, recording_url")
      .eq("agent_id", agentId)
      .order("started_at", { ascending: false });

    if (!error && data) {
      const mapped = (data as CallLogRow[]).map(mapCallLogToConversation);
      setConversations(mapped);
      if (mapped.length > 0) {
        setSelectedConversation(mapped[0]);
      }
    }
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Reset audio player when conversation changes
  useEffect(() => {
    setIsPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [selectedConversation]);

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.callerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.callerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" style={{ height: "calc(100vh - 160px)" }}>
          <div className="lg:col-span-3 border rounded-lg p-3 space-y-3">
            <Skeleton className="h-8 w-full" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2 py-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
          <div className="lg:col-span-5 border rounded-lg p-4 space-y-4">
            <Skeleton className="h-10 w-full rounded-lg" />
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <Skeleton className="h-16 w-3/4 rounded-lg" />
              </div>
            ))}
          </div>
          <div className="lg:col-span-4 border rounded-lg p-4 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center mb-4 animate-subtle-pulse"><MessageSquare className="w-12 h-12 text-muted-foreground" /></div>
        <h3 className="font-medium text-lg mb-1">No conversations yet</h3>
        <p className="text-sm text-muted-foreground">
          {isChat
            ? "Conversations will appear here once chats are made with this agent."
            : "Conversations will appear here once calls are made with this agent."}
        </p>
      </div>
    );
  }

  const selected = selectedConversation || conversations[0];

  return (
    <FeatureGate feature="conversations">
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="page-header-glow">
          <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-primary/40 mb-3" />
          <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
          <p className="text-muted-foreground/80 text-sm mt-1">
            {isChat ? "View and analyze chat transcripts" : "View and analyze call transcripts"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "card" ? "default" : "ghost"}
              size="sm"
              className={`h-8 px-2 rounded-r-none ${viewMode === "card" ? "bg-primary hover:bg-primary/90" : ""}`}
              onClick={() => setViewMode("card")}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              className={`h-8 px-2 rounded-l-none ${viewMode === "table" ? "bg-primary hover:bg-primary/90" : ""}`}
              onClick={() => setViewMode("table")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => toast.info("Export feature coming soon.")}>
            <Download className="w-4 h-4 mr-1.5" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[calc(100vh-160px)]">
        {/* Left Panel - Conversation List */}
        <div className="lg:col-span-3 rounded-xl bg-white overflow-hidden flex flex-col animate-slide-in-left" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="p-3 border-b space-y-2 bg-gradient-to-b from-muted/30 to-transparent">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Select defaultValue="7">
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                <SlidersHorizontal className="w-3 h-3 mr-1" />
                Filter
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full text-left p-3 border-b border-border/50 hover:bg-primary/[0.04] transition-all duration-150 ${
                  selected.id === conv.id ? "bg-primary/[0.08] border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm truncate">{conv.callerName}</span>
                  {conv.platform === "phone" ? (
                    <Phone className="w-3 h-3 text-muted-foreground" />
                  ) : (
                    <Globe className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{conv.timestamp}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                    {conv.platform}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{conv.duration}</span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate">{conv.id.slice(0, 16)}</span>
                </div>
              </button>
            ))}
            {filteredConversations.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No conversations match your search.
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Center Panel - Transcript */}
        <div className="lg:col-span-5 rounded-xl bg-white overflow-hidden flex flex-col animate-fade-in stagger-2" style={{ boxShadow: 'var(--shadow-sm)' }}>
          {/* Audio Player */}
          <div className="p-3 border-b bg-gradient-to-r from-muted/50 via-muted/30 to-transparent">
            {selected.recordingUrl ? (
              <div className="flex items-center gap-3">
                <audio
                  ref={audioRef}
                  src={selected.recordingUrl}
                  onTimeUpdate={(e) => setAudioCurrentTime(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration)}
                  onEnded={() => setIsPlaying(false)}
                  preload="metadata"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    if (!audioRef.current) return;
                    if (isPlaying) {
                      audioRef.current.pause();
                    } else {
                      audioRef.current.play();
                    }
                    setIsPlaying(!isPlaying);
                  }}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <div className="flex-1 h-8 relative flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={audioDuration || 0}
                    value={audioCurrentTime}
                    onChange={(e) => {
                      const time = parseFloat(e.target.value);
                      if (audioRef.current) {
                        audioRef.current.currentTime = time;
                      }
                      setAudioCurrentTime(time);
                    }}
                    className="w-full audio-player-range"
                  />
                </div>
                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                  {formatDuration(Math.floor(audioCurrentTime))} / {formatDuration(Math.floor(audioDuration))}
                </span>
                <a
                  href={selected.recordingUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <ArrowDownToLine className="w-4 h-4" />
                  </Button>
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled>
                  <Play className="w-4 h-4 text-muted-foreground" />
                </Button>
                <span className="text-xs text-muted-foreground">Recording unavailable</span>
                <span className="ml-auto text-xs text-muted-foreground font-mono">
                  {selected.duration}
                </span>
              </div>
            )}
          </div>

          {/* Transcript */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {selected.transcript.length > 0 ? (
                selected.transcript.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 ${
                        msg.role === "user"
                          ? "bg-primary text-white shadow-md shadow-primary/20 rounded-2xl rounded-br-md"
                          : "bg-muted text-foreground shadow-sm ring-1 ring-border/50 rounded-2xl"
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  No transcript available for this conversation.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Details */}
        <div className="lg:col-span-4 rounded-xl bg-white overflow-hidden animate-fade-in stagger-3" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <Tabs defaultValue="settings">
            <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-3 pt-2">
              <TabsTrigger value="settings" className="text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none">Settings</TabsTrigger>
              <TabsTrigger value="summary" className="text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none">Summary</TabsTrigger>
              <TabsTrigger value="evaluation" className="text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-none">Evaluation</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="p-4 space-y-4 mt-0">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Search in transcript</label>
                <Input placeholder="Search..." className="h-8 text-sm" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Actions</label>
                <div className="flex gap-2 mt-1">
                  <Button variant="outline" size="sm" className="h-8">
                    <Smile className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8">
                    <Bookmark className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-red-500 hover:text-red-700">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {isChat ? "Reason Chat Ended" : "Reason Call Ended"}
                </label>
                <Badge variant="outline" className="mt-1 block w-fit">
                  {selected.reasonEnded}
                </Badge>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <Textarea
                  placeholder="Add a note about this conversation..."
                  className="text-sm min-h-[100px]"
                />
              </div>
            </TabsContent>

            <TabsContent value="summary" className="p-4 mt-0">
              <div className="space-y-3">
                <h3 className="text-sm font-medium">AI-Generated Summary</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selected.summary}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="evaluation" className="p-4 mt-0">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Success Evaluation</h3>
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  {selected.evaluation.success ? (
                    <>
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                      <div>
                        <p className="font-medium text-green-700">Success: TRUE</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {selected.evaluation.criteria}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-8 h-8 text-red-600" />
                      <div>
                        <p className="font-medium text-red-700">Success: FALSE</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {selected.evaluation.criteria}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
    </FeatureGate>
  );
}
