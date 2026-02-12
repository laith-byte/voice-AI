"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, CheckCircle2, XCircle, MinusCircle } from "lucide-react";

interface AutomationLogsTableProps {
  automationId: string;
}

interface LogEntry {
  id: string;
  status: "success" | "failed" | "skipped";
  response_code: number | null;
  error_message: string | null;
  executed_at: string;
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const statusConfig = {
  success: {
    label: "Success",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: XCircle,
  },
  skipped: {
    label: "Skipped",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    icon: MinusCircle,
  },
} as const;

export function AutomationLogsTable({ automationId }: AutomationLogsTableProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch(`/api/automations/client/${automationId}/logs`);
        if (!res.ok) throw new Error("Failed to fetch logs");
        const data = await res.json();
        setLogs((data.logs ?? data ?? []).slice(0, 50));
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [automationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
        <Loader2 className="size-4 animate-spin" />
        Loading logs...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm py-8">
        No execution logs yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Response Code</TableHead>
          <TableHead>Error</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => {
          const config = statusConfig[log.status] ?? statusConfig.skipped;
          const Icon = config.icon;

          return (
            <TableRow key={log.id}>
              <TableCell
                className="text-muted-foreground text-xs"
                title={new Date(log.executed_at).toLocaleString()}
              >
                {timeAgo(log.executed_at)}
              </TableCell>
              <TableCell>
                <Badge className={config.className}>
                  <Icon className="size-3" />
                  {config.label}
                </Badge>
              </TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">
                {log.response_code ?? "—"}
              </TableCell>
              <TableCell
                className="text-xs text-muted-foreground max-w-[200px] truncate"
                title={log.error_message ?? undefined}
              >
                {log.error_message ?? "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
