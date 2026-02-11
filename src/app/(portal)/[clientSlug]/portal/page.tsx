"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
  Loader2,
  Phone,
  Clock,
  TrendingUp,
  TrendingDown,
  PhoneCall,
} from "lucide-react";
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
  agent_id: string;
  agent_name: string;
  caller_number: string | null;
  duration_seconds: number | null;
  started_at: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function PortalAgentsPage() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
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

  const fetchData = useCallback(async () => {
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
          // Recent 5 calls
          supabase
            .from("call_logs")
            .select("id, agent_id, caller_number, duration_seconds, started_at")
            .in("agent_id", agentIds)
            .order("started_at", { ascending: false })
            .limit(5),
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

        // Previous period active agents
        if (prevAgentsResult.data) {
          const uniquePrevAgents = new Set(prevAgentsResult.data.map((r) => r.agent_id));
          setPrevActiveAgents(uniquePrevAgents.size);
        }

        // Recent calls
        if (recentCallsResult.data) {
          setRecentCalls(
            recentCallsResult.data.map((c) => ({
              id: c.id,
              agent_id: c.agent_id,
              agent_name: agentNameMap.get(c.agent_id) ?? "Unknown Agent",
              caller_number: c.caller_number,
              duration_seconds: c.duration_seconds,
              started_at: c.started_at,
            }))
          );
        }
      }
    }

    setLoading(false);
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

      {/* Loading State */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border bg-white p-5">
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
          <div className="rounded-xl border border bg-white p-6">
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
              <div key={i} className="rounded-xl border border bg-white overflow-hidden">
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
                  {recentCalls.map((call) => (
                    <div
                      key={call.id}
                      className="group flex items-center justify-between py-3 px-3 rounded-lg hover:bg-primary/[0.04] hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/10 flex items-center justify-center">
                          <PhoneCall className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{call.agent_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {call.caller_number || "Unknown caller"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="text-sm font-medium font-mono" style={{ fontFeatureSettings: '"tnum"' }}>{formatDuration(call.duration_seconds)}</p>
                          <p className="text-xs text-muted-foreground/70">{formatRelativeTime(call.started_at)}</p>
                        </div>
                        <Link href={`/${clientSlug}/portal/agents/${call.agent_id}/conversations`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 empty-state-circle"><PhoneCall className="w-8 h-8 text-muted-foreground/60" /></div>
                  <p className="text-sm text-muted-foreground">No recent calls</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Call activity will appear here</p>
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
                          <DropdownMenuItem onClick={() => toast.info("Agent editing coming soon.")}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info("Agent duplication coming soon.")}>Duplicate</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => toast.info("Agent deletion coming soon.")}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <p className="text-[13px] text-muted-foreground line-clamp-2 mb-3">
                      {agent.description || "No description provided for this agent."}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Edited {formatRelativeTime(agent.created_at)}</span>
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
