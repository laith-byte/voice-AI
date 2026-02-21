"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  Database,
  Phone,
  BarChart3,
  Calendar,
  Loader2,
  PhoneCall,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
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
import type { AgentCostBreakdown } from "@/lib/retell-costs";
import { COST_COMPONENT_LABELS, FALLBACK_COST_PER_MINUTE } from "@/lib/retell-costs";

const STANDARD_NUMBER_COST = 2; // $/month
const TOLL_FREE_NUMBER_COST = 3; // $/month

interface CallLog {
  duration_seconds: number | null;
  started_at: string | null;
  agent_id: string | null;
}

interface ForecastData {
  current_spend: number;
  daily_average: number;
  projected_month_end: number;
  days_remaining: number;
  trend: "increasing" | "stable" | "decreasing";
}

export default function SettingsUsagePage() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [startDate, setStartDate] = useState(firstOfMonth.toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [totalCalls, setTotalCalls] = useState(0);
  const [knowledgeBases, setKnowledgeBases] = useState(0);
  const [standardNumbers, setStandardNumbers] = useState(0);
  const [tollFreeNumbers, setTollFreeNumbers] = useState(0);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);

  // Agent costs
  const [agentCosts, setAgentCosts] = useState<Record<string, AgentCostBreakdown>>({});
  const [costsLoading, setCostsLoading] = useState(true);

  // Forecast
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [forecastLoading, setForecastLoading] = useState(true);

  // Fetch agent costs on mount
  useEffect(() => {
    async function fetchAgentCosts() {
      setCostsLoading(true);
      try {
        const res = await fetch("/api/usage/agent-costs");
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, AgentCostBreakdown> = {};
          for (const agent of data.agents || []) {
            map[agent.agentId] = agent;
          }
          setAgentCosts(map);
        }
      } catch {
        // Fallback to flat rate
      } finally {
        setCostsLoading(false);
      }
    }
    fetchAgentCosts();
  }, []);

  // Fetch cost forecast on mount
  useEffect(() => {
    async function fetchForecast() {
      try {
        const res = await fetch("/api/usage/forecast");
        if (res.ok) {
          const data = await res.json();
          setForecast(data);
        }
      } catch {
        // Forecast is optional
      } finally {
        setForecastLoading(false);
      }
    }
    fetchForecast();
  }, []);

  const fetchUsageData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      // 1. Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Get user's organization_id
      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (!userData?.organization_id) return;

      const orgId = userData.organization_id;

      // Build date range boundaries (start of startDate to end of endDate)
      const rangeStart = new Date(`${startDate}T00:00:00`).toISOString();
      const rangeEnd = new Date(`${endDate}T23:59:59`).toISOString();

      // 3. Fetch call_logs in date range
      const { data: callLogs } = await supabase
        .from("call_logs")
        .select("duration_seconds, started_at, agent_id")
        .eq("organization_id", orgId)
        .gte("created_at", rangeStart)
        .lte("created_at", rangeEnd);

      if (callLogs) {
        setCallLogs(callLogs);
        setTotalCalls(callLogs.length);
        const totalSec = callLogs.reduce(
          (sum, log) => sum + (log.duration_seconds ?? 0),
          0
        );
        setTotalMinutes(Math.round((totalSec / 60) * 100) / 100);
      } else {
        setCallLogs([]);
        setTotalCalls(0);
        setTotalMinutes(0);
      }

      // 4. Fetch distinct knowledge bases from agents
      const { data: agentsData } = await supabase
        .from("agents")
        .select("knowledge_base_id")
        .eq("organization_id", orgId)
        .not("knowledge_base_id", "is", null);

      if (agentsData) {
        const uniqueKbs = new Set(agentsData.map((a) => a.knowledge_base_id));
        setKnowledgeBases(uniqueKbs.size);
      } else {
        setKnowledgeBases(0);
      }

      // 5. Fetch phone numbers split by type
      const { data: phoneData } = await supabase
        .from("phone_numbers")
        .select("type")
        .eq("organization_id", orgId);

      if (phoneData) {
        const standard = phoneData.filter(
          (p) => p.type !== "toll_free" && p.type !== "tollfree"
        ).length;
        const tollFree = phoneData.filter(
          (p) => p.type === "toll_free" || p.type === "tollfree"
        ).length;
        setStandardNumbers(standard);
        setTollFreeNumbers(tollFree);
      } else {
        setStandardNumbers(0);
        setTollFreeNumbers(0);
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  // Helper: get per-minute cost for a specific call log
  const getCostPerMinute = useCallback(
    (agentId: string | null) => {
      if (agentId && agentCosts[agentId]) {
        return agentCosts[agentId].perMinute;
      }
      return FALLBACK_COST_PER_MINUTE;
    },
    [agentCosts]
  );

  // Compute total cost using per-agent rates
  const totalCost = useMemo(() => {
    return callLogs.reduce((sum, log) => {
      const minutes = (log.duration_seconds ?? 0) / 60;
      return sum + minutes * getCostPerMinute(log.agent_id);
    }, 0);
  }, [callLogs, getCostPerMinute]);

  // Cost range across agents
  const costRange = useMemo(() => {
    const rates = Object.values(agentCosts).map((a) => a.perMinute);
    if (rates.length === 0) return null;
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    return { min, max };
  }, [agentCosts]);

  // Daily cost chart data: group call logs by date and calculate cost
  const dailyCostData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of callLogs) {
      if (!log.started_at) continue;
      const date = new Date(log.started_at).toISOString().split("T")[0];
      const minutes = (log.duration_seconds ?? 0) / 60;
      const cost = minutes * getCostPerMinute(log.agent_id);
      map[date] = (map[date] ?? 0) + cost;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cost]) => ({
        date: new Date(date + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        cost: Math.round(cost * 100) / 100,
      }));
  }, [callLogs, getCostPerMinute]);

  // Cost by component pie chart — aggregate across all call logs
  const costByProductData = useMemo(() => {
    const componentTotals: Record<string, number> = {};

    for (const log of callLogs) {
      const minutes = (log.duration_seconds ?? 0) / 60;
      if (minutes <= 0) continue;

      const agentId = log.agent_id;
      const breakdown = agentId ? agentCosts[agentId] : null;

      if (breakdown) {
        for (const [key, value] of Object.entries(breakdown.components)) {
          if (value > 0) {
            componentTotals[key] = (componentTotals[key] ?? 0) + minutes * value;
          }
        }
      } else {
        // Fallback: attribute all cost to infrastructure
        componentTotals["infrastructure"] =
          (componentTotals["infrastructure"] ?? 0) + minutes * FALLBACK_COST_PER_MINUTE;
      }
    }

    // Add fixed monthly costs
    const standardCost = standardNumbers * STANDARD_NUMBER_COST;
    const tollFreeCost = tollFreeNumbers * TOLL_FREE_NUMBER_COST;
    if (standardCost > 0) componentTotals["phoneNumbersStandard"] = standardCost;
    if (tollFreeCost > 0) componentTotals["phoneNumbersTollFree"] = tollFreeCost;

    const labelMap: Record<string, string> = {
      ...COST_COMPONENT_LABELS,
      phoneNumbersStandard: "Standard Numbers",
      phoneNumbersTollFree: "Toll-Free Numbers",
    };

    return Object.entries(componentTotals)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => ({
        name: labelMap[key] || key,
        value: Math.round(value * 100) / 100,
      }));
  }, [callLogs, agentCosts, standardNumbers, tollFreeNumbers]);

  const PIE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"];

  // Agent cost table data
  const agentCostList = useMemo(() => {
    return Object.values(agentCosts).sort((a, b) => b.perMinute - a.perMinute);
  }, [agentCosts]);

  return (
    <div className="space-y-6">
      {/* Date Range Picker */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#6b7280]" />
          <span className="text-sm text-[#6b7280]">Date Range:</span>
        </div>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-auto"
        />
        <span className="text-sm text-[#6b7280]">to</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-auto"
        />
        <Button variant="outline" size="sm" onClick={fetchUsageData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </Button>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="border border-[#e5e7eb] rounded-lg py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-[#6b7280]">Estimated Cost</p>
                  <p className="text-xl font-semibold text-[#111827]">
                    ${totalCost.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-[#9ca3af]">
                    {costsLoading ? (
                      "Loading agent rates..."
                    ) : costRange ? (
                      costRange.min === costRange.max
                        ? `@ $${costRange.min.toFixed(3)}/min`
                        : `$${costRange.min.toFixed(3)}–$${costRange.max.toFixed(3)}/min across agents`
                    ) : (
                      `@ $${FALLBACK_COST_PER_MINUTE.toFixed(2)}/min fallback`
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-[#2563eb]" />
                </div>
                <div>
                  <p className="text-xs text-[#6b7280]">Total Minutes</p>
                  <p className="text-xl font-semibold text-[#111827]">
                    {totalMinutes.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <PhoneCall className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-[#6b7280]">Total Calls</p>
                  <p className="text-xl font-semibold text-[#111827]">
                    {totalCalls.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Database className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-[#6b7280]">Knowledge Bases</p>
                  <p className="text-xl font-semibold text-[#111827]">
                    {knowledgeBases}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cost Per Agent Table */}
      {!costsLoading && agentCostList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[#6b7280]" />
              Cost Per Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e7eb]">
                    <th className="text-left py-2 font-medium text-[#6b7280]">Agent</th>
                    <th className="text-left py-2 font-medium text-[#6b7280]">LLM Model</th>
                    <th className="text-left py-2 font-medium text-[#6b7280]">Voice Provider</th>
                    <th className="text-right py-2 font-medium text-[#6b7280]">$/min</th>
                  </tr>
                </thead>
                <tbody>
                  {agentCostList.map((agent) => (
                    <tr key={agent.agentId} className="border-b border-[#f3f4f6]">
                      <td className="py-2 text-[#111827] font-medium">{agent.agentName}</td>
                      <td className="py-2 text-[#6b7280]">{agent.llmModel}</td>
                      <td className="py-2 text-[#6b7280] capitalize">{agent.voiceProvider}</td>
                      <td className="py-2 text-right text-[#111827] font-medium">
                        ${agent.perMinute.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Cost Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#6b7280]" />
              Daily Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyCostData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyCostData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      tickLine={false}
                      axisLine={{ stroke: "#e5e7eb" }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      tickLine={false}
                      axisLine={{ stroke: "#e5e7eb" }}
                      tickFormatter={(value: number) => `$${value}`}
                    />
                    <Tooltip
                      formatter={(value) => [`$${Number(value).toFixed(2)}`, "Cost"]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="cost" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center border border-[#e5e7eb]">
                <div className="text-center">
                  <BarChart3 className="h-8 w-8 text-[#e5e7eb] mx-auto mb-2" />
                  <p className="text-sm text-[#6b7280]">No call data for this period</p>
                  <p className="text-xs text-[#6b7280] mt-1">
                    Adjust the date range or make some calls to see data
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cost by Component Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#6b7280]" />
              Cost by Component
            </CardTitle>
          </CardHeader>
          <CardContent>
            {costByProductData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costByProductData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) =>
                        `${name || ""}: $${Number(value).toFixed(2)}`
                      }
                    >
                      {costByProductData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`$${Number(value).toFixed(2)}`, "Cost"]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center border border-[#e5e7eb]">
                <div className="text-center">
                  <TrendingUp className="h-8 w-8 text-[#e5e7eb] mx-auto mb-2" />
                  <p className="text-sm text-[#6b7280]">No cost data available</p>
                  <p className="text-xs text-[#6b7280] mt-1">
                    Usage costs will appear here once you have active resources
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cost Forecast */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#6b7280]" />
            Cost Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          {forecastLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[#6b7280]" />
            </div>
          ) : forecast && forecast.current_spend > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-gray-50 border border-[#e5e7eb]">
                  <DollarSign className="h-4 w-4 mx-auto text-[#6b7280] mb-1" />
                  <p className="text-lg font-semibold text-[#111827]">${forecast.current_spend.toFixed(2)}</p>
                  <p className="text-xs text-[#6b7280]">spent this month</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50 border border-[#e5e7eb]">
                  <Activity className="h-4 w-4 mx-auto text-[#6b7280] mb-1" />
                  <p className="text-lg font-semibold text-[#111827]">${forecast.daily_average.toFixed(2)}</p>
                  <p className="text-xs text-[#6b7280]">daily average</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50 border border-[#e5e7eb]">
                  <TrendingUp className="h-4 w-4 mx-auto text-[#6b7280] mb-1" />
                  <p className="text-lg font-semibold text-[#111827]">${forecast.projected_month_end.toFixed(2)}</p>
                  <p className="text-xs text-[#6b7280]">projected month-end</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50 border border-[#e5e7eb]">
                  <Calendar className="h-4 w-4 mx-auto text-[#6b7280] mb-1" />
                  <p className="text-lg font-semibold text-[#111827]">{forecast.days_remaining}</p>
                  <p className="text-xs text-[#6b7280]">days remaining</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {forecast.trend === "increasing" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                    <TrendingUp className="h-3 w-3" /> Increasing
                  </span>
                ) : forecast.trend === "decreasing" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    <TrendingDown className="h-3 w-3" /> Decreasing
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6b7280] bg-gray-100 px-2 py-1 rounded-full">
                    <Activity className="h-3 w-3" /> Stable
                  </span>
                )}
                <span className="text-xs text-[#6b7280]">Daily spend trend over the last 30 days</span>
              </div>
            </div>
          ) : (
            <div className="h-24 bg-gray-50 rounded-lg flex items-center justify-center border border-[#e5e7eb]">
              <div className="text-center">
                <TrendingUp className="h-6 w-6 text-[#e5e7eb] mx-auto mb-1" />
                <p className="text-sm text-[#6b7280]">No usage data for forecasting</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phone Numbers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-[#6b7280]" />
              Standard Phone Numbers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-[#111827]">
                  {loading ? "--" : standardNumbers}
                </p>
                <p className="text-xs text-[#6b7280] mt-1">Active numbers</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#6b7280]">Monthly cost</p>
                <p className="text-lg font-medium text-[#111827]">
                  ${(standardNumbers * 2).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-[#6b7280]" />
              Toll-Free Phone Numbers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-[#111827]">
                  {loading ? "--" : tollFreeNumbers}
                </p>
                <p className="text-xs text-[#6b7280] mt-1">Active numbers</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#6b7280]">Monthly cost</p>
                <p className="text-lg font-medium text-[#111827]">
                  ${(tollFreeNumbers * 3).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
