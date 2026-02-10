"use client";

import { useState, useEffect, useCallback } from "react";
import { Webhook, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

interface WebhookLogRow {
  id: string;
  organization_id: string;
  agent_id: string | null;
  event: string;
  import_result: string | null;
  forwarding_result: string | null;
  platform_call_id: string | null;
  raw_payload: Record<string, unknown> | null;
  timestamp: string;
}

interface AgentOption {
  id: string;
  name: string;
}

export default function SettingsWebhookLogsPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<WebhookLogRow[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [dateFilter, setDateFilter] = useState("7d");
  const [agentFilter, setAgentFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");

  const fetchData = useCallback(async () => {
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

      // 3. Fetch agents for filter dropdown
      const { data: agentData } = await supabase
        .from("agents")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name");

      if (agentData) {
        setAgents(agentData);
      }

      // 4. Build webhook_logs query with filters
      const now = new Date();
      let cutoff: Date;
      switch (dateFilter) {
        case "24h":
          cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      let query = supabase
        .from("webhook_logs")
        .select("id, organization_id, agent_id, event, import_result, forwarding_result, platform_call_id, raw_payload, timestamp")
        .eq("organization_id", orgId)
        .gte("timestamp", cutoff.toISOString())
        .order("timestamp", { ascending: false });

      if (eventFilter !== "all") {
        query = query.eq("event", eventFilter);
      }

      if (agentFilter !== "all") {
        query = query.eq("agent_id", agentFilter);
      }

      const { data: logsData, error } = await query;

      if (!error && logsData) {
        setLogs(logsData as WebhookLogRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, [dateFilter, eventFilter, agentFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const successCount = logs.filter((l) => l.import_result === "success").length;
  const successRate = logs.length > 0 ? Math.round((successCount / logs.length) * 100) : 0;
  const recoveredCount = logs.filter(
    (l) => l.import_result === "success" && l.event === "call.completed"
  ).length;

  function getEventBadgeStyle(event: string) {
    switch (event) {
      case "call.completed":
        return "bg-green-50 text-green-700 border border-green-200";
      case "call.started":
        return "bg-blue-50 text-[#2563eb] border border-blue-200";
      case "call.failed":
        return "bg-red-50 text-red-700 border border-red-200";
      case "import.error":
        return "bg-yellow-50 text-yellow-700 border border-yellow-200";
      default:
        return "bg-gray-100 text-[#6b7280] border border-[#e5e7eb]";
    }
  }

  function getResultIcon(result: string | null) {
    switch (result) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "skipped":
        return <AlertCircle className="h-4 w-4 text-[#6b7280]" />;
      default:
        return null;
    }
  }

  function formatTimestamp(ts: string) {
    return new Date(ts).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-medium text-[#111827]">Webhook Logs</h2>
        <p className="text-sm text-[#6b7280] mt-1">
          Monitor incoming webhooks, import results, and forwarding status.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Event" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="call.completed">call.completed</SelectItem>
            <SelectItem value="call.started">call.started</SelectItem>
            <SelectItem value="call.failed">call.failed</SelectItem>
            <SelectItem value="import.error">import.error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Import Success Rate</p>
              <p className="text-xl font-semibold text-[#111827]">
                {loading ? "--" : `${successRate}%`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Webhook className="h-5 w-5 text-[#2563eb]" />
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Conversations Recovered</p>
              <p className="text-xl font-semibold text-[#111827]">
                {loading ? "--" : recoveredCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="border border-[#e5e7eb] rounded-lg py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
        </div>
      ) : logs.length > 0 ? (
        <div className="border border-[#e5e7eb] rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-gray-50">
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Event
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Import Result
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Forwarding Result
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Platform Call ID
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className={getEventBadgeStyle(log.event)}
                    >
                      {log.event}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getResultIcon(log.import_result)}
                      <span className="text-sm text-[#6b7280] capitalize">
                        {log.import_result ?? "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getResultIcon(log.forwarding_result)}
                      <span className="text-sm text-[#6b7280] capitalize">
                        {log.forwarding_result ?? "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-[#6b7280]">
                      {log.platform_call_id ?? "—"}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6b7280]">
                    {formatTimestamp(log.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-[#e5e7eb] border-dashed rounded-lg py-16 flex flex-col items-center justify-center">
          <div className="bg-gray-100 rounded-full p-3 mb-4">
            <Webhook className="h-6 w-6 text-[#6b7280]" />
          </div>
          <h3 className="text-sm font-medium text-[#111827] mb-1">
            No webhook logs found
          </h3>
          <p className="text-sm text-[#6b7280]">
            Webhook logs will appear here once events are received.
          </p>
        </div>
      )}
    </div>
  );
}
