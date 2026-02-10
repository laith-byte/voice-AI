"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DollarSign,
  Clock,
  TrendingUp,
  Database,
  Phone,
  BarChart3,
  Calendar,
  Loader2,
  PhoneCall,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const COST_PER_MINUTE = 0.10;
const STANDARD_NUMBER_COST = 2; // $/month
const TOLL_FREE_NUMBER_COST = 3; // $/month

interface CallLog {
  duration_seconds: number | null;
  started_at: string | null;
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
        .select("duration_seconds, started_at")
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

  const totalCost = totalMinutes * COST_PER_MINUTE;

  // Daily cost chart data: group call logs by date and calculate cost
  const dailyCostData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of callLogs) {
      if (!log.started_at) continue;
      const date = new Date(log.started_at).toISOString().split("T")[0];
      const minutes = (log.duration_seconds ?? 0) / 60;
      const cost = minutes * COST_PER_MINUTE;
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
  }, [callLogs]);

  // Cost by product chart data
  const costByProductData = useMemo(() => {
    const voiceCost = totalMinutes * COST_PER_MINUTE;
    const standardCost = standardNumbers * STANDARD_NUMBER_COST;
    const tollFreeCost = tollFreeNumbers * TOLL_FREE_NUMBER_COST;
    // Knowledge bases are included for visibility even if free
    const items = [
      { name: "Voice Minutes", value: Math.round(voiceCost * 100) / 100 },
      { name: "Standard Numbers", value: standardCost },
      { name: "Toll-Free Numbers", value: tollFreeCost },
    ];
    // Only include items with non-zero cost
    return items.filter((item) => item.value > 0);
  }, [totalMinutes, standardNumbers, tollFreeNumbers]);

  const PIE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6"];

  return (
    <div className="space-y-6">
      {/* Date Range Picker */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#6b7280]" />
          <span className="text-sm text-[#6b7280]">Date Range:</span>
        </div>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border border-[#e5e7eb] rounded-md px-3 py-1.5 text-sm text-[#111827]"
        />
        <span className="text-sm text-[#6b7280]">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border border-[#e5e7eb] rounded-md px-3 py-1.5 text-sm text-[#111827]"
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
                    @ ${COST_PER_MINUTE.toFixed(2)}/min estimate
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

        {/* Cost by Product Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#6b7280]" />
              Cost by Product
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
