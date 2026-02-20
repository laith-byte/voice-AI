"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { FeatureGate } from "@/components/portal/feature-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Download,
  Phone,
  Globe,
  Play,
  Pause,
  LayoutGrid,
  List,
  CheckCircle2,
  XCircle,
  ArrowDownToLine,
  MessageSquare,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileDown,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  rawTimestamp: string | null;
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
    rawTimestamp: log.started_at,
  };
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div className="p-6 flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <ConversationsContent />
    </Suspense>
  );
}

function ConversationsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const agentId = params.id as string;
  const callIdParam = searchParams.get("callId");

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetConversation, setSheetConversation] = useState<Conversation | null>(null);
  const [dateRange, setDateRange] = useState("all");
  const [transcriptSearch, setTranscriptSearch] = useState("");

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // Check if this is a chat agent
    const { data: agentData } = await supabase
      .from("agents")
      .select("platform")
      .eq("id", agentId)
      .single();
    if (agentData?.platform === "retell-chat" || agentData?.platform === "retell-sms") {
      setIsChat(true);
    } else {
      setIsChat(false);
    }

    const { data, error } = await supabase
      .from("call_logs")
      .select("id, retell_call_id, from_number, duration_seconds, status, summary, evaluation, transcript, metadata, started_at, recording_url")
      .eq("agent_id", agentId)
      .order("started_at", { ascending: false });

    if (error) {
      toast.error("Failed to load conversations");
    } else if (data) {
      const mapped = (data as CallLogRow[]).map(mapCallLogToConversation);
      setConversations(mapped);
      if (mapped.length > 0) {
        // Deep-link: select the conversation matching callId query param, or fall back to first
        const target = callIdParam
          ? mapped.find((c) => c.id === callIdParam) ?? mapped[0]
          : mapped[0];
        setSelectedConversation(target);
      }
    }
    setLoading(false);
  }, [agentId, callIdParam]);

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

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.callerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.callerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.id.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (dateRange !== "all" && conv.rawTimestamp) {
      const days = parseInt(dateRange);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (new Date(conv.rawTimestamp) < cutoff) return false;
    }
    return true;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredConversations.length / pageSize));
  const paginatedConversations = filteredConversations.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to page 1 when search or date range changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateRange]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredConversations.length === 0) {
      toast.error("No conversations to export.");
      return;
    }
    const headers = ["Call ID", "Caller", "Phone/ID", "Date & Time", "Platform", "Duration", "Status", "Evaluation", "Summary"];
    const csvEscape = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
    const rows = filteredConversations.map((c) => [
      csvEscape(c.id),
      csvEscape(c.callerName),
      csvEscape(c.callerId),
      csvEscape(c.timestamp),
      csvEscape(c.platform),
      csvEscape(c.duration),
      csvEscape(c.reasonEnded),
      csvEscape(c.evaluation.success ? "Success" : "Failed"),
      csvEscape(c.summary || ""),
    ]);
    const csv = "\uFEFF" + [headers.map(csvEscape).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conversations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredConversations.length} conversations.`);
  };

  // PDF Export
  const handleExportPDF = async () => {
    if (filteredConversations.length === 0) {
      toast.error("No conversations to export.");
      return;
    }
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      doc.setFontSize(16);
      doc.text("Conversations Report", 14, y);
      y += 8;
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generated ${new Date().toLocaleDateString()} | ${filteredConversations.length} conversations`, 14, y);
      doc.setTextColor(0);
      y += 12;

      for (const conv of filteredConversations) {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(conv.callerName, 14, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`${conv.timestamp} | ${conv.duration} | ${conv.platform}`, 14, y + 4);
        doc.setTextColor(0);
        y += 10;

        doc.setFontSize(9);
        const summaryLines = doc.splitTextToSize(conv.summary || "No summary.", pageWidth - 28);
        doc.text(summaryLines, 14, y);
        y += summaryLines.length * 4 + 4;

        if (conv.transcript.length > 0) {
          doc.setFontSize(8);
          for (const msg of conv.transcript.slice(0, 10)) {
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
            const prefix = msg.role === "agent" ? "Agent: " : "User: ";
            const lines = doc.splitTextToSize(prefix + msg.content, pageWidth - 28);
            doc.text(lines, 14, y);
            y += lines.length * 3.5 + 1;
          }
          if (conv.transcript.length > 10) {
            doc.setTextColor(100);
            doc.text(`... ${conv.transcript.length - 10} more messages`, 14, y);
            doc.setTextColor(0);
            y += 5;
          }
        }

        y += 6;
        doc.setDrawColor(220);
        doc.line(14, y, pageWidth - 14, y);
        y += 6;
      }

      doc.save(`conversations-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(`Exported ${filteredConversations.length} conversations as PDF.`);
    } catch {
      toast.error("Failed to generate PDF.");
    }
  };

  // Open slide-out panel (table view)
  const handleRowClick = (conv: Conversation) => {
    setSheetConversation(conv);
    setSheetOpen(true);
  };

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="w-4 h-4" />
                Export
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileDown className="w-4 h-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ============ CARD VIEW (3-panel layout) ============ */}
      {viewMode === "card" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[calc(100vh-160px)]">
          {/* Left Panel - Conversation List */}
          <div className="lg:col-span-3 rounded-xl bg-white overflow-hidden flex flex-col animate-slide-in-left" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <div className="p-3 border-b space-y-2 bg-gradient-to-b from-muted/30 to-transparent">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by caller, ID, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="flex-1">
              {paginatedConversations.map((conv) => (
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
            {/* Card view pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 border-t">
                <span className="text-xs text-muted-foreground">
                  {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredConversations.length)} of {filteredConversations.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
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
                  selected.transcript.map((msg, i) => {
                    const isHighlighted =
                      transcriptSearch &&
                      msg.content.toLowerCase().includes(transcriptSearch.toLowerCase());
                    return (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] px-3 py-2 ${
                            msg.role === "user"
                              ? "bg-primary text-white shadow-md shadow-primary/20 rounded-2xl rounded-br-md"
                              : "bg-muted text-foreground shadow-sm ring-1 ring-border/50 rounded-2xl"
                          } ${isHighlighted ? "ring-2 ring-yellow-400" : ""}`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {msg.time}
                          </p>
                        </div>
                      </div>
                    );
                  })
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
                  <Input
                    placeholder="Search..."
                    className="h-8 text-sm"
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                  />
                  {transcriptSearch && (
                    <p className="text-[10px] text-muted-foreground">
                      {selected.transcript.filter((m) =>
                        m.content.toLowerCase().includes(transcriptSearch.toLowerCase())
                      ).length}{" "}
                      match{selected.transcript.filter((m) =>
                        m.content.toLowerCase().includes(transcriptSearch.toLowerCase())
                      ).length !== 1 ? "es" : ""}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {isChat ? "Reason Chat Ended" : "Reason Call Ended"}
                  </label>
                  <Badge variant="outline" className="mt-1 block w-fit">
                    {selected.reasonEnded}
                  </Badge>
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
      )}

      {/* ============ TABLE VIEW ============ */}
      {viewMode === "table" && (
        <div className="space-y-4">
          {/* Search bar for table view */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by caller, ID, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredConversations.length} conversation{filteredConversations.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Data Table */}
          <div className="rounded-xl bg-white border overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold text-muted-foreground pl-4">Caller</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Phone / ID</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Date & Time</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Platform</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Duration</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Evaluation</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedConversations.map((conv) => (
                  <TableRow
                    key={conv.id}
                    className="cursor-pointer hover:bg-primary/[0.03] transition-colors"
                    onClick={() => handleRowClick(conv)}
                  >
                    <TableCell className="pl-4">
                      <span className="font-medium text-sm">{conv.callerName}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground font-mono">{conv.callerId.length > 20 ? conv.callerId.slice(0, 20) + "..." : conv.callerId}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{conv.timestamp}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px] h-5 gap-1">
                        {conv.platform === "phone" ? <Phone className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                        {conv.platform}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono">{conv.duration}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px] h-5 capitalize">
                        {conv.reasonEnded}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {conv.evaluation.success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(conv);
                        }}
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedConversations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                      No conversations match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {filteredConversations.length > 0 && (
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows per page</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="h-7 w-[70px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredConversations.length)} of {filteredConversations.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ SLIDE-OUT DETAIL PANEL (Sheet) ============ */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col overflow-hidden">
          {sheetConversation && (
            <>
              {/* Sticky top: Header + Recording */}
              <div className="flex-shrink-0">
                <SheetHeader className="p-5 pb-3 bg-gradient-to-b from-muted/30 to-transparent">
                  <SheetTitle className="text-lg">{sheetConversation.callerName}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[10px] h-4 gap-1">
                      {sheetConversation.platform === "phone" ? <Phone className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                      {sheetConversation.platform}
                    </Badge>
                    <span>{sheetConversation.timestamp}</span>
                    <span className="font-mono">{sheetConversation.duration}</span>
                  </SheetDescription>
                </SheetHeader>

                {/* Recording - sticky below header */}
                <div className="px-5 pb-3 border-b">
                  {sheetConversation.recordingUrl ? (
                    <div className="rounded-lg border bg-muted/20 p-2.5 flex items-center gap-2.5">
                      <audio controls className="w-full h-8" src={sheetConversation.recordingUrl} preload="metadata" />
                      <a href={sheetConversation.recordingUrl} download target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <ArrowDownToLine className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </a>
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-muted/10 p-2.5 flex items-center gap-2">
                      <Play className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Recording unavailable</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Scrollable content: Transcript then Details */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-5 space-y-5">
                  {/* Transcript */}
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Transcript</p>
                    <div className="space-y-3">
                      {sheetConversation.transcript.length > 0 ? (
                        sheetConversation.transcript.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[85%] px-3 py-2 ${
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
                        <p className="text-sm text-muted-foreground text-center py-6">No transcript available.</p>
                      )}
                    </div>
                  </div>

                  {/* Summary - after transcript */}
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Summary</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{sheetConversation.summary}</p>
                  </div>

                  {/* Detail Cards - after transcript */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Call ID</p>
                      <p className="text-xs font-mono truncate">{sheetConversation.id}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Caller ID</p>
                      <p className="text-xs font-mono truncate">{sheetConversation.callerId}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                      <Badge variant="outline" className="text-[10px] h-4 capitalize">{sheetConversation.reasonEnded}</Badge>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Evaluation</p>
                      <div className="flex items-center gap-1.5">
                        {sheetConversation.evaluation.success ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            <span className="text-xs text-green-700 font-medium">Success</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-xs text-red-600 font-medium">Failed</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
    </FeatureGate>
  );
}
