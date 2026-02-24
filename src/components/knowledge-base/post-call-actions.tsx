"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { ActionEmailSummary } from "./action-email-summary";
import { ActionSmsNotification } from "./action-sms-notification";
import { ActionCallerFollowup } from "./action-caller-followup";
import { ActionDailyDigest } from "./action-daily-digest";

interface PostCallActionsProps {
  clientId?: string;
  agentId?: string;
}

interface ActionState {
  isEnabled: boolean;
  config: Record<string, unknown>;
}

type ActionType =
  | "email_summary"
  | "sms_notification"
  | "caller_followup_email"
  | "daily_digest";

const DEFAULT_STATES: Record<ActionType, ActionState> = {
  email_summary: {
    isEnabled: false,
    config: {
      recipients: [],
      include_summary: true,
      include_transcript: true,
      include_caller_info: true,
      include_recording: false,
      trigger: "all",
    },
  },
  sms_notification: {
    isEnabled: false,
    config: {
      phone_number: "",
      trigger: "missed",
    },
  },
  caller_followup_email: {
    isEnabled: false,
    config: {
      subject: "Thanks for calling {{business_name}}!",
      body: "Hi {{caller_name}},\n\nThank you for calling us today. If you have any further questions, please don't hesitate to reach out.\n\nBest regards,\n{{business_name}}",
      delay_minutes: 15,
    },
  },
  daily_digest: {
    isEnabled: false,
    config: {
      recipients: [],
      send_at_hour: 18,
      include_count: true,
      include_avg_duration: true,
      include_missed: true,
      include_topics: true,
      include_transcripts: false,
    },
  },
};

function apiUrl(clientId?: string, agentId?: string) {
  const base = "/api/post-call-actions";
  const params = new URLSearchParams();
  if (clientId) params.set("client_id", clientId);
  if (agentId) params.set("agent_id", agentId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function PostCallActions({ clientId, agentId }: PostCallActionsProps) {
  const [actions, setActions] = useState<Record<ActionType, ActionState>>(
    () => ({ ...DEFAULT_STATES })
  );
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<ActionType | null>(null);

  const fetchActions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(clientId, agentId));
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      const fetched = { ...DEFAULT_STATES };
      for (const action of data.actions || []) {
        const type = action.action_type as ActionType;
        if (fetched[type]) {
          fetched[type] = {
            isEnabled: action.is_enabled,
            config: { ...DEFAULT_STATES[type].config, ...action.config },
          };
        }
      }
      setActions(fetched);
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, [clientId, agentId]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  async function saveAction(actionType: ActionType, isEnabled: boolean, config: Record<string, unknown>) {
    // Update local state immediately
    setActions((prev) => ({
      ...prev,
      [actionType]: { isEnabled, config },
    }));

    // Debounce-save to API
    setSavingAction(actionType);
    try {
      const res = await fetch(apiUrl(clientId, agentId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: actionType,
          is_enabled: isEnabled,
          config,
          ...(agentId ? { agent_id: agentId } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? "Failed to save");
      }

      toast.success(
        `${formatActionName(actionType)} ${isEnabled ? "enabled" : "updated"}`,
        { duration: 2000 }
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save action"
      );
    } finally {
      setSavingAction(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight">Post-Call Actions</h2>
          <p className="text-xs text-muted-foreground">
            What should happen automatically after every call?
          </p>
        </div>
        {savingAction && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </div>
        )}
      </div>

      <ActionEmailSummary
        isEnabled={actions.email_summary.isEnabled}
        config={actions.email_summary.config}
        onChange={(enabled, config) =>
          saveAction("email_summary", enabled, config)
        }
      />

      <ActionSmsNotification
        isEnabled={actions.sms_notification.isEnabled}
        config={actions.sms_notification.config}
        onChange={(enabled, config) =>
          saveAction("sms_notification", enabled, config)
        }
      />

      <ActionCallerFollowup
        isEnabled={actions.caller_followup_email.isEnabled}
        config={actions.caller_followup_email.config}
        onChange={(enabled, config) =>
          saveAction("caller_followup_email", enabled, config)
        }
      />

      <ActionDailyDigest
        isEnabled={actions.daily_digest.isEnabled}
        config={actions.daily_digest.config}
        onChange={(enabled, config) =>
          saveAction("daily_digest", enabled, config)
        }
      />

    </div>
  );
}

function formatActionName(type: ActionType): string {
  const names: Record<ActionType, string> = {
    email_summary: "Email Summary",
    sms_notification: "SMS Notification",
    caller_followup_email: "Caller Follow-Up",
    daily_digest: "Daily Digest",
  };
  return names[type] || type;
}
