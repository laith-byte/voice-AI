"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Search,
  Bot,
  MoreHorizontal,
  ArrowRight,
  Phone,
  Clock,
  TrendingUp,
  TrendingDown,
  PhoneCall,
  MessageSquare,
  Rocket,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  platform: string;
  created_at: string;
}

interface RecentCall {
  id: string;
  retell_call_id: string | null;
  agent_id: string;
  agent_name: string;
  from_number: string | null;
  duration_seconds: number | null;
  started_at: string;
  summary: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  transcript: string | null;
  type: "voice" | "chat" | "sms";
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getDateGroup(dateStr: string): "Today" | "This Week" | "Earlier" {
  const now = new Date();
  const date = new Date(dateStr);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

  if (date >= startOfToday) return "Today";
  if (date >= startOfWeek) return "This Week";
  return "Earlier";
}

function getPreviewText(call: RecentCall): string | null {
  if (call.summary) {
    return call.summary.length > 80 ? call.summary.slice(0, 80) + "..." : call.summary;
  }
  if (call.transcript) {
    const firstLine = call.transcript.split("\n").find((l) => l.trim());
    if (firstLine) {
      return firstLine.length > 80 ? firstLine.slice(0, 80) + "..." : firstLine;
    }
  }
  return null;
}

export default function PortalAgentsPage() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState("");

  // KPI state
  const [totalCalls, setTotalCalls] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [activeAgents, setActiveAgents] = useState(0);
  const [prevCalls, setPrevCalls] = useState(0);
  const [prevMinutes, setPrevMinutes] = useState(0);
  const [prevActiveAgents, setPrevActiveAgents] = useState(0);

  // Recent activity
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);

  // Onboarding status
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [totalCallsSinceLive, setTotalCallsSinceLive] = useState(0);

  const fetchData = useCallback(async () => {
    try {
    const supabase = createClient();

    // Fetch client name for personalized header
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userData } = await supabase
        .from("users")
        .select("client_id")
        .eq("id", user.id)
        .single();
      if (userData?.client_id) {
        const { data: clientData } = await supabase
          .from("clients")
          .select("name")
          .eq("id", userData.client_id)
          .single();
        if (clientData) setClientName(clientData.name);
      }
    }

    // Fetch onboarding status
    try {
      const onboardingRes = await fetch("/api/onboarding/status");
      if (onboardingRes.ok) {
        const onboardingData = await onboardingRes.json();
        setOnboardingStatus(onboardingData.status ?? "not_started");
        setOnboardingStep(onboardingData.current_step ?? 1);
        setTotalCallsSinceLive(onboardingData.total_calls_since_live ?? 0);
      }
    } catch {
      // Onboarding check is non-critical
    }

    // Fetch agents (RLS handles client scoping)
    const { data: agentsData, error: agentsError } = await supabase
      .from("agents")
      .select("id, name, description, platform, created_at")
      .order("created_at", { ascending: false });

    if (!agentsError && agentsData) {
      setAgents(agentsData);
      setActiveAgents(agentsData.length);

      const agentIds = agentsData.map((a) => a.id);
      const agentNameMap = new Map(agentsData.map((a) => [a.id, a.name]));

      if (agentIds.length > 0) {
        // Date boundaries for last 30 and previous 30 days
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        const sixtyDaysAgo = new Date(now);
        sixtyDaysAgo.setDate(now.getDate() - 60);

        // Fetch all call logs for last 60 days + recent 5
        const [callLogsResult, recentCallsResult, prevAgentsResult] = await Promise.all([
          // All calls in last 60 days for KPIs
          supabase
            .from("call_logs")
            .select("agent_id, duration_seconds, started_at")
            .in("agent_id", agentIds)
            .gte("started_at", sixtyDaysAgo.toISOString()),
          // Recent 4 calls
          supabase
            .from("call_logs")
            .select("id, retell_call_id, agent_id, from_number, duration_seconds, started_at, summary, status, metadata, transcript")
            .in("agent_id", agentIds)
            .order("started_at", { ascending: false })
            .limit(4),
          // Count distinct agents with calls in previous 30 days for trend
          supabase
            .from("call_logs")
            .select("agent_id")
            .in("agent_id", agentIds)
            .gte("started_at", sixtyDaysAgo.toISOString())
            .lt("started_at", thirtyDaysAgo.toISOString()),
        ]);

        // Process call logs into current vs previous 30 days
        if (callLogsResult.data) {
          const current = callLogsResult.data.filter(
            (log) => log.started_at && new Date(log.started_at) >= thirtyDaysAgo
          );
          const previous = callLogsResult.data.filter(
            (log) =>
              log.started_at &&
              new Date(log.started_at) >= sixtyDaysAgo &&
              new Date(log.started_at) < thirtyDaysAgo
          );

          setTotalCalls(current.length);
          setPrevCalls(previous.length);

          const currentSec = current.reduce((sum, l) => sum + (l.duration_seconds ?? 0), 0);
          const previousSec = previous.reduce((sum, l) => sum + (l.duration_seconds ?? 0), 0);
          setTotalMinutes(Math.round((currentSec / 60) * 100) / 100);
          setPrevMinutes(Math.round((previousSec / 60) * 100) / 100);
        }

        // Previous period active agents (count distinct agents with calls in previous 30 days)
        if (prevAgentsResult.data) {
          const prevDistinctAgents = new Set(prevAgentsResult.data.map((r) => r.agent_id));
          setPrevActiveAgents(prevDistinctAgents.size);
        }

        // Recent calls
        if (recentCallsResult.data) {
          setRecentCalls(
            recentCallsResult.data.map((c) => {
              const meta = c.metadata as Record<string, unknown> | null;
              return {
                id: c.id,
                retell_call_id: c.retell_call_id ?? null,
                agent_id: c.agent_id,
                agent_name: agentNameMap.get(c.agent_id) ?? "Unknown Agent",
                from_number: c.from_number,
                duration_seconds: c.duration_seconds,
                started_at: c.started_at,
                summary: c.summary ?? null,
                status: c.status ?? null,
                metadata: meta,
                transcript: c.transcript ?? null,
                type: (meta?.type === "chat" ? "chat" : meta?.type === "sms" ? "sms" : "voice") as "voice" | "chat" | "sms",
              };
            })
          );
        }
      }
    }

    setLoading(false);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Trend calculation helper
  function calcChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  const callsChange = calcChange(totalCalls, prevCalls);
  const minutesChange = calcChange(totalMinutes, prevMinutes);
  const agentsChange = calcChange(activeAgents, prevActiveAgents);

  function formatRelativeTime(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="page-header-glow">
        <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-primary/40 mb-3" />
        <h1 className="text-3xl font-bold tracking-tight">{getGreeting()}{clientName ? `, ${clientName}` : ""}</h1>
        <p className="text-muted-foreground/80 text-sm mt-1">
          Here&apos;s an overview of your agents and recent activity
        </p>
      </div>

      {/* Onboarding Banner */}
      {onboardingStatus && onboardingStatus !== "completed" && onboardingStatus !== "skipped" && (
        <Card className="animate-fade-in-up glass-card border-primary/20 bg-gradient-to-r from-primary/[0.04] via-primary/[0.02] to-transparent overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                  {onboardingStatus === "not_started" ? (
                    <Sparkles className="w-6 h-6 text-white" />
                  ) : (
                    <Rocket className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-[15px]">
                    {onboardingStatus === "not_started"
                      ? "Welcome! Let's set up your AI agent"
                      : `Continue setup (Step ${onboardingStep} of 6)`}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {onboardingStatus === "not_started"
                      ? "Get your AI voice agent up and running in just a few minutes."
                      : "You're almost there! Pick up right where you left off."}
                  </p>
                </div>
              </div>
              <Link href={`/${clientSlug}/portal/onboarding`}>
                <Button className="gap-2 shadow-sm bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80">
                  {onboardingStatus === "not_started" ? "Get Started" : "Continue Setup"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 10+ Calls Analytics Banner */}
      {onboardingStatus === "completed" && totalCallsSinceLive >= 10 && (
        <Card className="animate-fade-in-up glass-card border-green-500/20 bg-gradient-to-r from-green-500/[0.04] via-green-500/[0.02] to-transparent overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/20 shrink-0">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[15px]">
                    Your agent has handled {totalCallsSinceLive}+ calls!
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Check out your analytics dashboard for call insights, trends, and performance metrics.
                  </p>
                </div>
              </div>
              {agents.length > 0 && (
                <Link href={`/${clientSlug}/portal/agents/${agents[0].id}/analytics`}>
                  <Button className="gap-2 shadow-sm bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400">
                    View Analytics
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border bg-white p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24 shimmer" />
                    <Skeleton className="h-8 w-16 shimmer" />
                    <Skeleton className="h-3 w-32 shimmer" />
                  </div>
                  <Skeleton className="h-14 w-14 rounded-2xl shimmer" />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-white p-6">
            <Skeleton className="h-5 w-32 mb-4 shimmer" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg shimmer" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24 shimmer" />
                    <Skeleton className="h-3 w-20 shimmer" />
                  </div>
                </div>
                <Skeleton className="h-4 w-12 shimmer" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border bg-white overflow-hidden">
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg shimmer" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-24 shimmer" />
                      <Skeleton className="h-3 w-16 shimmer" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-full shimmer" />
                  <Skeleton className="h-3 w-2/3 shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="animate-fade-in-up stagger-1 glass-card kpi-accent-blue rounded-xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Total Calls
                    </p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-4xl font-extrabold tracking-tight" style={{ fontFeatureSettings: '"tnum"' }}>{totalCalls.toLocaleString()}</span>
                      {prevCalls > 0 && (
                        <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ring-1 ring-inset ${callsChange >= 0 ? "bg-green-500/15 text-green-700 ring-green-500/20" : "bg-red-500/15 text-red-700 ring-red-500/20"}`}>
                          {callsChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {callsChange >= 0 ? "+" : ""}{callsChange.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1">vs. {prevCalls} previous 30 days</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center kpi-icon-blue transition-transform duration-200 hover:rotate-3 hover:scale-110">
                    <Phone className="w-7 h-7 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-fade-in-up stagger-2 glass-card kpi-accent-green rounded-xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Total Minutes
                    </p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-4xl font-extrabold tracking-tight" style={{ fontFeatureSettings: '"tnum"' }}>{totalMinutes.toLocaleString()}</span>
                      {prevMinutes > 0 && (
                        <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ring-1 ring-inset ${minutesChange >= 0 ? "bg-green-500/15 text-green-700 ring-green-500/20" : "bg-red-500/15 text-red-700 ring-red-500/20"}`}>
                          {minutesChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {minutesChange >= 0 ? "+" : ""}{minutesChange.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1">vs. {prevMinutes} previous 30 days</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center kpi-icon-green transition-transform duration-200 hover:rotate-3 hover:scale-110">
                    <Clock className="w-7 h-7 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-fade-in-up stagger-3 glass-card kpi-accent-purple rounded-xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Active Agents
                    </p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-4xl font-extrabold tracking-tight" style={{ fontFeatureSettings: '"tnum"' }}>{activeAgents}</span>
                      {prevActiveAgents > 0 && (
                        <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ring-1 ring-inset ${agentsChange >= 0 ? "bg-green-500/15 text-green-700 ring-green-500/20" : "bg-red-500/15 text-red-700 ring-red-500/20"}`}>
                          {agentsChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {agentsChange >= 0 ? "+" : ""}{agentsChange.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1">assigned to your account</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center kpi-icon-purple transition-transform duration-200 hover:rotate-3 hover:scale-110">
                    <Bot className="w-7 h-7 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="animate-fade-in-up stagger-4 glass-card rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-semibold tracking-tight">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentCalls.length > 0 ? (
                <div className="space-y-1">
                  {(["Today", "This Week", "Earlier"] as const).map((group) => {
                    const groupCalls = recentCalls.filter(
                      (c) => getDateGroup(c.started_at) === group
                    );
                    if (groupCalls.length === 0) return null;
                    return (
                      <div key={group}>
                        <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider px-3 pt-3 pb-1">
                          {group}
                        </p>
                        {groupCalls.map((call) => {
                          const isChat = call.type === "chat";
                          const preview = getPreviewText(call);
                          const callHref = `/${clientSlug}/portal/agents/${call.agent_id}/conversations?callId=${encodeURIComponent(call.retell_call_id || call.id)}`;
                          return (
                            <Link
                              key={call.id}
                              href={callHref}
                              className="group flex items-center justify-between py-3 px-3 rounded-lg hover:bg-primary/[0.04] hover:shadow-sm transition-all"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center ring-1 shrink-0",
                                    isChat
                                      ? "bg-gradient-to-br from-blue-500/15 to-blue-500/5 ring-blue-500/10"
                                      : "bg-gradient-to-br from-primary/15 to-primary/5 ring-primary/10"
                                  )}
                                >
                                  {isChat ? (
                                    <MessageSquare className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <PhoneCall className="w-4 h-4 text-primary" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium truncate">{call.agent_name}</p>
                                    <span
                                      className={cn(
                                        "w-2 h-2 rounded-full shrink-0",
                                        call.status === "completed" || call.status === "ended"
                                          ? "bg-green-500"
                                          : call.status === "in-progress" || call.status === "active"
                                            ? "bg-yellow-500 animate-pulse"
                                            : "bg-gray-400"
                                      )}
                                    />
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {isChat ? "Chat session" : call.from_number || "Unknown caller"}
                                  </p>
                                  {preview && (
                                    <p className="text-xs text-muted-foreground/60 truncate mt-0.5">
                                      {preview}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-right shrink-0">
                                <div>
                                  <p className="text-sm font-medium font-mono" style={{ fontFeatureSettings: '"tnum"' }}>
                                    {formatDuration(call.duration_seconds)}
                                  </p>
                                  <p className="text-xs text-muted-foreground/70">
                                    {formatRelativeTime(call.started_at)}
                                  </p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 empty-state-circle">
                    <PhoneCall className="w-8 h-8 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Call and chat activity will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agent Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold tracking-tight">Agents</h2>
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl shadow-none focus:shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAgents.map((agent, index) => (
                <div
                  key={agent.id}
                  className="group relative rounded-xl overflow-hidden agent-card animate-fade-in-up"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-primary ring-2 ring-primary/20 flex items-center justify-center" style={{ boxShadow: 'var(--shadow-primary)' }}>
                          <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[15px]">{agent.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="w-2 h-2 rounded-full bg-green-500 status-dot-active" />
                            <span className="text-xs text-muted-foreground capitalize">active</span>
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            router.push(`/${clientSlug}/portal/agents/${agent.id}/agent-settings`);
                          }}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info("Agent duplication coming soon.")}>Duplicate</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={async () => {
                            if (!window.confirm(`Permanently delete agent "${agent.name}" and all its data?`)) return;
                            try {
                              const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
                              if (!res.ok) {
                                const err = await res.json().catch(() => null);
                                throw new Error(err?.error ?? "Failed to delete agent");
                              }
                              toast.success("Agent deleted");
                              fetchData();
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Failed to delete agent");
                            }
                          }}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <p className="text-[13px] text-muted-foreground line-clamp-2 mb-3">
                      {agent.description || "No description provided for this agent."}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Created {formatRelativeTime(agent.created_at)}</span>
                      <Badge variant="outline" className="text-[10px] h-5">
                        {clientName || "Client"}
                      </Badge>
                    </div>
                  </div>

                  {/* Hover action bar */}
                  <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200 backdrop-blur-sm bg-gradient-to-t from-white/95 via-white/90 to-white/0 pt-6 pb-3 px-5">
                    <Link href={`/${clientSlug}/portal/agents/${agent.id}/analytics`} className="block">
                      <Button className="w-full bg-primary hover:bg-primary/90 shadow-sm" size="sm">
                        View Dashboard
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {filteredAgents.length === 0 && (
              <div className="text-center py-12">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center mx-auto mb-4"><Bot className="w-10 h-10 text-muted-foreground/60" /></div>
                <h3 className="font-medium text-lg mb-1">No agents found</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your search query</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
