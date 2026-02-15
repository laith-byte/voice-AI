"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { FeatureGate } from "@/components/portal/feature-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Phone, Clock, MessageSquare, MessagesSquare, TrendingUp, TrendingDown, CheckCircle2, Users, Timer, ArrowDownUp, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

interface CallLog {
  id: string;
  duration_seconds: number | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  started_at: string | null;
  evaluation: string | null;
  from_number: string | null;
  direction: string | null;
}

const DONUT_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export default function AnalyticsPage() {
  const params = useParams();
  const agentId = params.id as string;
  const [dateRange, setDateRange] = useState("7");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChat, setIsChat] = useState(false);

  const fetchCallLogs = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // Detect agent platform
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

    if (dateRange === "custom") {
      if (!customStart || !customEnd) {
        setLoading(false);
        return;
      }
      const start = new Date(customStart);
      const end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
      // Fetch a previous period of equal length for comparison
      const rangeDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - rangeDays);

      const { data, error } = await supabase
        .from("call_logs")
        .select("id, duration_seconds, status, metadata, started_at, evaluation, from_number, direction")
        .eq("agent_id", agentId)
        .gte("started_at", prevStart.toISOString())
        .lte("started_at", end.toISOString())
        .order("started_at", { ascending: true });

      if (!error && data) {
        setCallLogs(data);
      }
    } else {
      const days = parseInt(dateRange);
      // Fetch double the range to cover both current and previous periods
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days * 2);

      const { data, error } = await supabase
        .from("call_logs")
        .select("id, duration_seconds, status, metadata, started_at, evaluation, from_number, direction")
        .eq("agent_id", agentId)
        .gte("started_at", startDate.toISOString())
        .order("started_at", { ascending: true });

      if (!error && data) {
        setCallLogs(data);
      }
    }
    setLoading(false);
  }, [agentId, dateRange, customStart, customEnd]);

  useEffect(() => {
    fetchCallLogs();
  }, [fetchCallLogs]);

  const days = dateRange === "custom"
    ? (customStart && customEnd
        ? Math.max(1, Math.round((new Date(customEnd).getTime() - new Date(customStart).getTime()) / (1000 * 60 * 60 * 24)))
        : 7)
    : parseInt(dateRange);
  const { now, currentPeriodStart, previousPeriodStart } = useMemo(() => {
    const n = dateRange === "custom" && customEnd
      ? (() => { const d = new Date(customEnd); d.setHours(23, 59, 59, 999); return d; })()
      : new Date();
    const cps = dateRange === "custom" && customStart
      ? new Date(customStart)
      : (() => { const d = new Date(n); d.setDate(n.getDate() - days); return d; })();
    const pps = new Date(cps);
    pps.setDate(pps.getDate() - days);
    return { now: n, currentPeriodStart: cps, previousPeriodStart: pps };
  }, [dateRange, customStart, customEnd, days]);

  const currentLogs = useMemo(
    () => callLogs.filter((log) => log.started_at && new Date(log.started_at) >= currentPeriodStart),
    [callLogs, currentPeriodStart]
  );

  const previousLogs = useMemo(
    () =>
      callLogs.filter(
        (log) =>
          log.started_at &&
          new Date(log.started_at) >= previousPeriodStart &&
          new Date(log.started_at) < currentPeriodStart
      ),
    [callLogs, previousPeriodStart, currentPeriodStart]
  );

  // KPI: Total Call Minutes
  const currentMinutes = useMemo(
    () => Math.round(currentLogs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0) / 60),
    [currentLogs]
  );
  const previousMinutes = useMemo(
    () => Math.round(previousLogs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0) / 60),
    [previousLogs]
  );
  const minutesChange = previousMinutes > 0 ? ((currentMinutes - previousMinutes) / previousMinutes) * 100 : 0;

  // KPI: Number of Calls
  const currentCallCount = currentLogs.length;
  const previousCallCount = previousLogs.length;
  const callCountChange = previousCallCount > 0 ? ((currentCallCount - previousCallCount) / previousCallCount) * 100 : 0;

  // KPI: Success Rate
  const currentSuccessCount = useMemo(() => {
    return currentLogs.filter((l) => {
      if (!l.evaluation) return false;
      const ev = l.evaluation.toLowerCase();
      return ev.includes("true") || ev.includes("success") || ev.includes("passed");
    }).length;
  }, [currentLogs]);
  const previousSuccessCount = useMemo(() => {
    return previousLogs.filter((l) => {
      if (!l.evaluation) return false;
      const ev = l.evaluation.toLowerCase();
      return ev.includes("true") || ev.includes("success") || ev.includes("passed");
    }).length;
  }, [previousLogs]);
  const currentSuccessRate = currentCallCount > 0 ? (currentSuccessCount / currentCallCount) * 100 : 0;
  const previousSuccessRate = previousCallCount > 0 ? (previousSuccessCount / previousCallCount) * 100 : 0;
  const successRateChange = previousSuccessRate > 0 ? currentSuccessRate - previousSuccessRate : 0;

  // KPI: Avg Call Duration (seconds)
  const currentAvgDuration = useMemo(() => {
    const withDuration = currentLogs.filter((l) => l.duration_seconds && l.duration_seconds > 0);
    if (withDuration.length === 0) return 0;
    return Math.round(withDuration.reduce((s, l) => s + (l.duration_seconds || 0), 0) / withDuration.length);
  }, [currentLogs]);
  const previousAvgDuration = useMemo(() => {
    const withDuration = previousLogs.filter((l) => l.duration_seconds && l.duration_seconds > 0);
    if (withDuration.length === 0) return 0;
    return Math.round(withDuration.reduce((s, l) => s + (l.duration_seconds || 0), 0) / withDuration.length);
  }, [previousLogs]);
  const avgDurationChange = previousAvgDuration > 0 ? ((currentAvgDuration - previousAvgDuration) / previousAvgDuration) * 100 : 0;
  const formatAvgDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  // KPI: Unique Callers
  const currentUnique = useMemo(() => {
    const numbers = new Set(currentLogs.filter((l) => l.from_number).map((l) => l.from_number));
    return numbers.size;
  }, [currentLogs]);
  const previousUnique = useMemo(() => {
    const numbers = new Set(previousLogs.filter((l) => l.from_number).map((l) => l.from_number));
    return numbers.size;
  }, [previousLogs]);
  const uniqueChange = previousUnique > 0 ? ((currentUnique - previousUnique) / previousUnique) * 100 : 0;

  // Line chart data: group by date for current and previous periods
  const callMinutesData = useMemo(() => {
    const dateMap = new Map<string, { current: number; previous: number }>();
    // Build date labels for N days
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - (days - 1 - i));
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dateMap.set(label, { current: 0, previous: 0 });
    }
    // Current period
    for (const log of currentLogs) {
      if (!log.started_at) continue;
      const d = new Date(log.started_at);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const entry = dateMap.get(label);
      if (entry) {
        entry.current += Math.round((log.duration_seconds || 0) / 60);
      }
    }
    // Previous period — map each day offset into the same label slot
    for (const log of previousLogs) {
      if (!log.started_at) continue;
      const d = new Date(log.started_at);
      // Shift forward by N days to align with current period labels
      const shifted = new Date(d);
      shifted.setDate(d.getDate() + days);
      const label = shifted.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const entry = dateMap.get(label);
      if (entry) {
        entry.previous += Math.round((log.duration_seconds || 0) / 60);
      }
    }
    return Array.from(dateMap.entries()).map(([date, vals]) => ({
      date,
      current: vals.current,
      previous: vals.previous,
    }));
  }, [currentLogs, previousLogs, days, now]);

  const numberOfCallsData = useMemo(() => {
    const dateMap = new Map<string, { current: number; previous: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - (days - 1 - i));
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dateMap.set(label, { current: 0, previous: 0 });
    }
    for (const log of currentLogs) {
      if (!log.started_at) continue;
      const d = new Date(log.started_at);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const entry = dateMap.get(label);
      if (entry) entry.current += 1;
    }
    for (const log of previousLogs) {
      if (!log.started_at) continue;
      const d = new Date(log.started_at);
      const shifted = new Date(d);
      shifted.setDate(d.getDate() + days);
      const label = shifted.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const entry = dateMap.get(label);
      if (entry) entry.previous += 1;
    }
    return Array.from(dateMap.entries()).map(([date, vals]) => ({
      date,
      current: vals.current,
      previous: vals.previous,
    }));
  }, [currentLogs, previousLogs, days, now]);

  // Donut chart: group by disconnection reason
  const callEndedData = useMemo(() => {
    const reasonMap = new Map<string, number>();
    for (const log of currentLogs) {
      const reason =
        (log.metadata as Record<string, unknown>)?.disconnection_reason as string ||
        log.status ||
        "Unknown";
      const label = reason
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      reasonMap.set(label, (reasonMap.get(label) || 0) + 1);
    }
    return Array.from(reasonMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        color: DONUT_COLORS[i % DONUT_COLORS.length],
      }));
  }, [currentLogs]);

  // Duration Distribution (histogram buckets)
  const durationDistData = useMemo(() => {
    const buckets = [
      { label: "0-30s", min: 0, max: 30, count: 0 },
      { label: "30s-1m", min: 30, max: 60, count: 0 },
      { label: "1-2m", min: 60, max: 120, count: 0 },
      { label: "2-5m", min: 120, max: 300, count: 0 },
      { label: "5-10m", min: 300, max: 600, count: 0 },
      { label: "10m+", min: 600, max: Infinity, count: 0 },
    ];
    for (const log of currentLogs) {
      const dur = log.duration_seconds || 0;
      for (const bucket of buckets) {
        if (dur >= bucket.min && dur < bucket.max) {
          bucket.count += 1;
          break;
        }
      }
    }
    return buckets.map((b) => ({ name: b.label, count: b.count }));
  }, [currentLogs]);

  // Peak Hours Heatmap (hour x day-of-week)
  const peakHoursData = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const log of currentLogs) {
      if (!log.started_at) continue;
      const d = new Date(log.started_at);
      const day = d.getDay(); // 0=Sun, 6=Sat
      const hour = d.getHours();
      grid[day][hour] += 1;
    }
    const maxVal = Math.max(1, ...grid.flat());
    return { grid, maxVal };
  }, [currentLogs]);

  // Inbound vs Outbound
  const directionData = useMemo(() => {
    let inbound = 0;
    let outbound = 0;
    let unknown = 0;
    for (const log of currentLogs) {
      if (log.direction === "inbound") inbound++;
      else if (log.direction === "outbound") outbound++;
      else unknown++;
    }
    const result: { name: string; value: number; color: string }[] = [];
    if (inbound > 0) result.push({ name: "Inbound", value: inbound, color: "#2563eb" });
    if (outbound > 0) result.push({ name: "Outbound", value: outbound, color: "#10b981" });
    if (unknown > 0 && inbound === 0 && outbound === 0) result.push({ name: "Unknown", value: unknown, color: "#94a3b8" });
    return result;
  }, [currentLogs]);

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
    if (i === 0) return "12a";
    if (i < 12) return `${i}a`;
    if (i === 12) return "12p";
    return `${i - 12}p`;
  });

  return (
    <FeatureGate feature="analytics">
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="page-header-glow">
          <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-primary/40 mb-3" />
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground/80 text-sm mt-1">Agent performance overview</p>
        </div>
        <div className="flex items-center gap-3">
          {dateRange === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-[145px] h-9 text-sm"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-[145px] h-9 text-sm"
              />
            </div>
          )}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border p-6">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-3 w-48 mb-4" />
                <Skeleton className="h-[280px] w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* KPI Row 1: Primary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="animate-fade-in-up stagger-1 glass-card rounded-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      {isChat ? "Total Messages" : "Total Call Minutes"}
                    </p>
                    <div className="flex items-baseline gap-2.5 mt-2">
                      <span className="text-4xl font-extrabold tracking-tight" style={{ fontFeatureSettings: '"tnum"' }}>{currentMinutes}</span>
                      {previousMinutes > 0 && (
                        <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ring-1 ring-inset ${minutesChange >= 0 ? "bg-green-500/15 text-green-700 ring-green-500/20" : "bg-red-500/15 text-red-700 ring-red-500/20"}`}>
                          {minutesChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {minutesChange >= 0 ? "+" : ""}{minutesChange.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1.5">vs. {previousMinutes} previous period</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/12 to-primary/4 flex items-center justify-center shadow-sm transition-transform duration-200 hover:rotate-3 hover:scale-110">
                    {isChat ? <MessagesSquare className="w-6 h-6 text-primary" /> : <Clock className="w-6 h-6 text-primary" />}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="animate-fade-in-up stagger-2 glass-card rounded-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      {isChat ? "Number of Conversations" : "Number of Calls"}
                    </p>
                    <div className="flex items-baseline gap-2.5 mt-2">
                      <span className="text-4xl font-extrabold tracking-tight" style={{ fontFeatureSettings: '"tnum"' }}>{currentCallCount}</span>
                      {previousCallCount > 0 && (
                        <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ring-1 ring-inset ${callCountChange >= 0 ? "bg-green-500/15 text-green-700 ring-green-500/20" : "bg-red-500/15 text-red-700 ring-red-500/20"}`}>
                          {callCountChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {callCountChange >= 0 ? "+" : ""}{callCountChange.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1.5">vs. {previousCallCount} previous period</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/12 to-green-500/4 flex items-center justify-center shadow-sm transition-transform duration-200 hover:rotate-3 hover:scale-110">
                    {isChat ? <MessageSquare className="w-6 h-6 text-green-600" /> : <Phone className="w-6 h-6 text-green-600" />}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="animate-fade-in-up stagger-3 glass-card rounded-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Success Rate</p>
                    <div className="flex items-baseline gap-2.5 mt-2">
                      <span className="text-4xl font-extrabold tracking-tight" style={{ fontFeatureSettings: '"tnum"' }}>{currentSuccessRate.toFixed(0)}%</span>
                      {previousCallCount > 0 && (
                        <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ring-1 ring-inset ${successRateChange >= 0 ? "bg-green-500/15 text-green-700 ring-green-500/20" : "bg-red-500/15 text-red-700 ring-red-500/20"}`}>
                          {successRateChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {successRateChange >= 0 ? "+" : ""}{successRateChange.toFixed(1)}pp
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1.5">{currentSuccessCount} of {currentCallCount} successful</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/12 to-emerald-500/4 flex items-center justify-center shadow-sm transition-transform duration-200 hover:rotate-3 hover:scale-110">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* KPI Row 2: Secondary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="animate-fade-in-up stagger-4 glass-card rounded-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Average Duration</p>
                    <div className="flex items-baseline gap-2.5 mt-2">
                      <span className="text-4xl font-extrabold tracking-tight" style={{ fontFeatureSettings: '"tnum"' }}>{formatAvgDuration(currentAvgDuration)}</span>
                      {previousAvgDuration > 0 && (
                        <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ring-1 ring-inset ${avgDurationChange >= 0 ? "bg-green-500/15 text-green-700 ring-green-500/20" : "bg-red-500/15 text-red-700 ring-red-500/20"}`}>
                          {avgDurationChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {avgDurationChange >= 0 ? "+" : ""}{avgDurationChange.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1.5">vs. {formatAvgDuration(previousAvgDuration)} previous period</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/12 to-amber-500/4 flex items-center justify-center shadow-sm transition-transform duration-200 hover:rotate-3 hover:scale-110">
                    <Timer className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="animate-fade-in-up stagger-5 glass-card rounded-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Unique Callers</p>
                    <div className="flex items-baseline gap-2.5 mt-2">
                      <span className="text-4xl font-extrabold tracking-tight" style={{ fontFeatureSettings: '"tnum"' }}>{currentUnique}</span>
                      {previousUnique > 0 && (
                        <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ring-1 ring-inset ${uniqueChange >= 0 ? "bg-green-500/15 text-green-700 ring-green-500/20" : "bg-red-500/15 text-red-700 ring-red-500/20"}`}>
                          {uniqueChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {uniqueChange >= 0 ? "+" : ""}{uniqueChange.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1.5">vs. {previousUnique} previous period</p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/12 to-violet-500/4 flex items-center justify-center shadow-sm transition-transform duration-200 hover:rotate-3 hover:scale-110">
                    <Users className="w-6 h-6 text-violet-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trend Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="animate-fade-in-up glass-card rounded-xl">
              <CardHeader className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-transparent">
                <CardTitle className="text-lg font-semibold tracking-tight">{isChat ? "Total Messages" : "Total Call Minutes"}</CardTitle>
                <p className="text-sm text-muted-foreground/70">Latest vs Previous period</p>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={callMinutesData}>
                      <defs>
                        <linearGradient id="gradientMinutes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px -2px rgba(0,0,0,0.1)", backdropFilter: "blur(8px)", backgroundColor: "rgba(255,255,255,0.85)" }} />
                      <Area type="monotone" dataKey="current" fill="url(#gradientMinutes)" stroke="none" />
                      <Line type="monotone" dataKey="current" stroke="#2563eb" strokeWidth={2} dot={{ r: 4, fill: "#2563eb" }} name="Current" />
                      <Line type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: "#94a3b8" }} name="Previous" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-fade-in-up glass-card rounded-xl">
              <CardHeader className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-transparent">
                <CardTitle className="text-lg font-semibold tracking-tight">{isChat ? "Number of Conversations" : "Number of Calls"}</CardTitle>
                <p className="text-sm text-muted-foreground/70">Latest vs Previous period</p>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={numberOfCallsData}>
                      <defs>
                        <linearGradient id="gradientCalls" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px -2px rgba(0,0,0,0.1)", backdropFilter: "blur(8px)", backgroundColor: "rgba(255,255,255,0.85)" }} />
                      <Area type="monotone" dataKey="current" fill="url(#gradientCalls)" stroke="none" />
                      <Line type="monotone" dataKey="current" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: "#10b981" }} name="Current" />
                      <Line type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: "#94a3b8" }} name="Previous" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Duration Distribution */}
            <Card className="animate-fade-in-up glass-card rounded-xl">
              <CardHeader className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-transparent">
                <CardTitle className="text-lg font-semibold tracking-tight">Duration Distribution</CardTitle>
                <p className="text-sm text-muted-foreground/70">How long calls typically last</p>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={durationDistData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                      <Tooltip formatter={(value) => [`${value} calls`, "Count"]} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px -2px rgba(0,0,0,0.1)", backdropFilter: "blur(8px)", backgroundColor: "rgba(255,255,255,0.85)" }} />
                      <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Inbound vs Outbound */}
            <Card className="animate-fade-in-up glass-card rounded-xl">
              <CardHeader className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-transparent">
                <CardTitle className="text-lg font-semibold tracking-tight">
                  {isChat ? "Channel Split" : "Inbound vs Outbound"}
                </CardTitle>
                <p className="text-sm text-muted-foreground/70">Call direction breakdown</p>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] flex items-center justify-center">
                  {directionData.length > 0 ? (
                    <div className="w-full flex items-center gap-6">
                      <div className="flex-1">
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={directionData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={4} dataKey="value" isAnimationActive animationDuration={800}>
                              {directionData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value) => {
                                const v = Number(value) || 0;
                                const total = directionData.reduce((s, e) => s + e.value, 0);
                                return [`${v} (${total > 0 ? ((v / total) * 100).toFixed(0) : 0}%)`, ""];
                              }}
                              contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px -2px rgba(0,0,0,0.1)", backgroundColor: "rgba(255,255,255,0.85)" }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-3 pr-4">
                        {directionData.map((d) => (
                          <div key={d.name} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${d.color}15` }}>
                              {d.name === "Inbound" ? <PhoneIncoming className="w-4 h-4" style={{ color: d.color }} /> : d.name === "Outbound" ? <PhoneOutgoing className="w-4 h-4" style={{ color: d.color }} /> : <Phone className="w-4 h-4" style={{ color: d.color }} />}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{d.name}</p>
                              <p className="text-xs text-muted-foreground">{d.value} call{d.value !== 1 ? "s" : ""}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 empty-state-circle">
                        <ArrowDownUp className="w-7 h-7 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm text-muted-foreground">No direction data available</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Direction is recorded for phone calls</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Call Activity Heatmap */}
          <Card className="animate-fade-in-up glass-card rounded-xl">
            <CardHeader className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-transparent">
              <CardTitle className="text-lg font-semibold tracking-tight">Call Activity</CardTitle>
              <p className="text-sm text-muted-foreground/70">When your agent receives calls — based on actual call data for this period</p>
            </CardHeader>
            <CardContent className="pt-4">
              {currentLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[640px]">
                    <div className="flex ml-10 mb-1">
                      {HOUR_LABELS.map((h, i) => (
                        <div key={i} className="flex-1 text-center text-[9px] text-muted-foreground/70">{i % 3 === 0 ? h : ""}</div>
                      ))}
                    </div>
                    {DAY_LABELS.map((day, dayIdx) => (
                      <div key={day} className="flex items-center gap-1 mb-[3px]">
                        <span className="w-9 text-[11px] text-muted-foreground font-medium text-right pr-1">{day}</span>
                        <div className="flex flex-1 gap-[2px]">
                          {peakHoursData.grid[dayIdx].map((count, hourIdx) => {
                            const intensity = count / peakHoursData.maxVal;
                            return (
                              <div
                                key={hourIdx}
                                className="flex-1 rounded-[3px] transition-colors duration-150"
                                style={{
                                  height: "24px",
                                  backgroundColor: count === 0 ? "#f1f5f9" : `rgba(37, 99, 235, ${0.15 + intensity * 0.85})`,
                                }}
                                title={`${day} ${HOUR_LABELS[hourIdx]}: ${count} call${count !== 1 ? "s" : ""}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-end gap-1 mt-3 mr-1">
                      <span className="text-[10px] text-muted-foreground mr-1">Less</span>
                      {[0, 0.25, 0.5, 0.75, 1].map((level) => (
                        <div key={level} className="w-4 h-4 rounded-[3px]" style={{ backgroundColor: level === 0 ? "#f1f5f9" : `rgba(37, 99, 235, ${0.15 + level * 0.85})` }} />
                      ))}
                      <span className="text-[10px] text-muted-foreground ml-1">More</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No data for this period</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reason Call Ended */}
          <Card className="animate-fade-in-up glass-card rounded-xl">
            <CardHeader className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-transparent">
              <CardTitle className="text-lg font-semibold tracking-tight">{isChat ? "Reason Chat Ended" : "Reason Call Ended"}</CardTitle>
              <p className="text-sm text-muted-foreground/70">{isChat ? "Distribution of chat ending reasons" : "Distribution of call ending reasons"}</p>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center">
                {callEndedData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={callEndedData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={3} dataKey="value" isAnimationActive animationBegin={200} animationDuration={800} label={false}>
                        {callEndedData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => {
                          const v = Number(value) || 0;
                          const total = callEndedData.reduce((s, e) => s + e.value, 0);
                          const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
                          return [`${v} (${pct}%)`, ""];
                        }}
                        contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px -2px rgba(0,0,0,0.1)", backdropFilter: "blur(8px)", backgroundColor: "rgba(255,255,255,0.85)" }}
                      />
                      <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" iconSize={8} formatter={(value) => <span className="text-sm text-foreground">{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 empty-state-circle">
                      <Phone className="w-7 h-7 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm text-muted-foreground">No data for this period</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Data will appear as calls are made</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
    </FeatureGate>
  );
}
