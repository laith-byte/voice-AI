"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
} from "lucide-react";

interface SyncEvent {
  id: string;
  provider: string;
  event_type: string;
  direction: string;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

const PROVIDER_BADGES: Record<string, { label: string; className: string }> = {
  housecallpro: { label: "HCP", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  jobber: { label: "Jobber", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  salesforce: { label: "SF", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  gohighlevel: { label: "GHL", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  hubspot: { label: "HS", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

function formatEventType(eventType: string): string {
  return eventType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function RecentSyncsWidget() {
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecentSyncs() {
      try {
        const res = await fetch("/api/integrations/recent-syncs");
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch {
        // silently fail — widget is non-critical
      } finally {
        setLoading(false);
      }
    }

    fetchRecentSyncs();
  }, []);

  if (loading) {
    return (
      <Card className="glass-card rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold tracking-tight">Recent Syncs</CardTitle>
        </CardHeader>
        <CardContent>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-6 w-6 rounded shimmer" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-24 shimmer" />
                <Skeleton className="h-2 w-16 shimmer" />
              </div>
              <Skeleton className="h-4 w-12 shimmer" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) return null;

  return (
    <Card className="animate-fade-in-up glass-card rounded-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <CardTitle className="text-lg font-semibold tracking-tight">
            Recent Syncs
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {events.map((event) => {
            const providerBadge = PROVIDER_BADGES[event.provider] || {
              label: event.provider,
              className: "bg-gray-100 text-gray-700",
            };

            return (
              <div
                key={event.id}
                className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {event.status === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : event.status === "retrying" ? (
                    <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>

                {/* Direction indicator */}
                <div className="shrink-0">
                  {event.direction === "outbound" ? (
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                  ) : (
                    <ArrowDownLeft className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>

                {/* Event details */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {formatEventType(event.event_type)}
                  </p>
                  {event.entity_type && (
                    <p className="text-xs text-muted-foreground truncate">
                      {event.entity_type}
                      {event.entity_id ? ` #${event.entity_id.slice(0, 8)}` : ""}
                    </p>
                  )}
                </div>

                {/* Provider badge */}
                <Badge
                  variant="secondary"
                  className={`text-[10px] h-5 shrink-0 ${providerBadge.className}`}
                >
                  {providerBadge.label}
                </Badge>

                {/* Timestamp */}
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatRelativeTime(event.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
