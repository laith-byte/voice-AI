"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, Clock, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import {
  LineChart,
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
} from "recharts";
import { createClient } from "@/lib/supabase/client";

interface CallLog {
  id: string;
  duration_seconds: number | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  started_at: string | null;
}

const DONUT_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export default function AnalyticsPage() {
  const params = useParams();
  const agentId = params.id as string;
  const [dateRange, setDateRange] = useState("7");
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCallLogs = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const days = parseInt(dateRange);
    // Fetch double the range to cover both current and previous periods
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days * 2);

    const { data, error } = await supabase
      .from("call_logs")
      .select("id, duration_seconds, status, metadata, started_at")
      .eq("agent_id", agentId)
      .gte("started_at", startDate.toISOString())
      .order("started_at", { ascending: true });

    if (!error && data) {
      setCallLogs(data);
    }
    setLoading(false);
  }, [agentId, dateRange]);

  useEffect(() => {
    fetchCallLogs();
  }, [fetchCallLogs]);

  const days = parseInt(dateRange);
  const now = new Date();
  const currentPeriodStart = new Date(now);
  currentPeriodStart.setDate(now.getDate() - days);
  const previousPeriodStart = new Date(now);
  previousPeriodStart.setDate(now.getDate() - days * 2);

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Agent performance overview</p>
        </div>
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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Total Call Minutes
                    </p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-bold">{currentMinutes}</span>
                      {previousMinutes > 0 && (
                        <div className={`flex items-center gap-1 text-xs ${minutesChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {minutesChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {minutesChange >= 0 ? "+" : ""}{minutesChange.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">vs. {previousMinutes} previous period</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Number of Calls
                    </p>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-bold">{currentCallCount}</span>
                      {previousCallCount > 0 && (
                        <div className={`flex items-center gap-1 text-xs ${callCountChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {callCountChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {callCountChange >= 0 ? "+" : ""}{callCountChange.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">vs. {previousCallCount} previous period</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                    <Phone className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Call Minutes Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Call Minutes</CardTitle>
                <p className="text-xs text-muted-foreground">Latest vs Previous period</p>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={callMinutesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="current"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#2563eb" }}
                        name="Current"
                      />
                      <Line
                        type="monotone"
                        dataKey="previous"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 3, fill: "#94a3b8" }}
                        name="Previous"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Number of Calls Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Number of Calls</CardTitle>
                <p className="text-xs text-muted-foreground">Latest vs Previous period</p>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={numberOfCallsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="current"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#10b981" }}
                        name="Current"
                      />
                      <Line
                        type="monotone"
                        dataKey="previous"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 3, fill: "#94a3b8" }}
                        name="Previous"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Donut Chart - Reason Call Ended */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reason Call Ended</CardTitle>
              <p className="text-xs text-muted-foreground">Distribution of call ending reasons</p>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center">
                {callEndedData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={callEndedData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={3}
                        dataKey="value"
                      >
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
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Legend
                        verticalAlign="middle"
                        align="right"
                        layout="vertical"
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">No data for this period</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
