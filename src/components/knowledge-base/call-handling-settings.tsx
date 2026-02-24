"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneCall, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface CallHandlingSettingsProps {
  clientId?: string;
  agentId?: string;
  initialSettings?: Record<string, unknown> | null;
}

function apiUrl(path: string, clientId?: string) {
  const base = `/api/knowledge-base${path}`;
  return clientId ? `${base}?client_id=${clientId}` : base;
}

export function CallHandlingSettings({
  clientId,
  agentId,
  initialSettings,
}: CallHandlingSettingsProps) {
  // After-hours behavior
  const [afterHoursBehavior, setAfterHoursBehavior] = useState("message");
  // Unanswerable behavior
  const [unanswerableBehavior, setUnanswerableBehavior] = useState("message");
  // Escalation phone (visible if unanswerable = transfer)
  const [escalationPhone, setEscalationPhone] = useState("");
  // Max call duration
  const [maxCallDuration, setMaxCallDuration] = useState("10");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const applySettings = useCallback((settings: Record<string, unknown>) => {
    setAfterHoursBehavior(
      (settings.after_hours_behavior as string) ?? "message"
    );
    setUnanswerableBehavior(
      (settings.unanswerable_behavior as string) ?? "message"
    );
    setEscalationPhone((settings.escalation_phone as string) ?? "");
    setMaxCallDuration(
      settings.max_call_duration_minutes
        ? String(settings.max_call_duration_minutes)
        : "10"
    );
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      if (initialSettings) {
        applySettings(initialSettings);
        setLoading(false);
        return;
      }
      const url = agentId
        ? `/api/agents/${agentId}/call-handling`
        : apiUrl("", clientId);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      const settings = agentId ? data : (data.settings ?? data);
      if (settings) {
        applySettings(settings);
      }
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  }, [agentId, clientId, initialSettings, applySettings]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave() {
    setSaving(true);
    const payload = {
      after_hours_behavior: afterHoursBehavior,
      unanswerable_behavior: unanswerableBehavior,
      escalation_phone:
        unanswerableBehavior === "transfer" ? escalationPhone.trim() : null,
      max_call_duration_minutes: parseInt(maxCallDuration, 10),
    };

    const url = agentId
      ? `/api/agents/${agentId}/call-handling`
      : apiUrl("", clientId);

    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? "Failed to save settings");
      }

      toast.success("Call handling settings saved successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings"
      );
    } finally {
      setSaving(false);
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
    <Card className="overflow-hidden animate-fade-in-up glass-card">
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
            <PhoneCall className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Call Handling</h3>
            <p className="text-[11px] text-muted-foreground">
              Configure how your AI agent handles calls and follow-ups
            </p>
          </div>
        </div>
      </div>
      <CardContent className="p-4 space-y-6">
        {/* After Hours Behavior */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">After Hours Behavior</Label>
          <p className="text-[11px] text-muted-foreground -mt-2">
            What should the AI do when a call comes in outside business hours?
          </p>
          <RadioGroup
            value={afterHoursBehavior}
            onValueChange={setAfterHoursBehavior}
            className="space-y-2"
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value="callback" id="ah-callback" />
              <Label htmlFor="ah-callback" className="text-sm font-normal cursor-pointer">
                Offer to schedule a callback
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="message" id="ah-message" />
              <Label htmlFor="ah-message" className="text-sm font-normal cursor-pointer">
                Take a message
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="hours" id="ah-hours" />
              <Label htmlFor="ah-hours" className="text-sm font-normal cursor-pointer">
                Share business hours and end call
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="border-t" />

        {/* Unanswerable Behavior */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Unanswerable Question Behavior
          </Label>
          <p className="text-[11px] text-muted-foreground -mt-2">
            What should the AI do when it cannot answer a question?
          </p>
          <RadioGroup
            value={unanswerableBehavior}
            onValueChange={setUnanswerableBehavior}
            className="space-y-2"
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value="transfer" id="ua-transfer" />
              <Label htmlFor="ua-transfer" className="text-sm font-normal cursor-pointer">
                Transfer to a human
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="message" id="ua-message" />
              <Label htmlFor="ua-message" className="text-sm font-normal cursor-pointer">
                Take a message for follow-up
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="callback" id="ua-callback" />
              <Label htmlFor="ua-callback" className="text-sm font-normal cursor-pointer">
                Find out and call them back
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="website" id="ua-website" />
              <Label htmlFor="ua-website" className="text-sm font-normal cursor-pointer">
                Direct caller to your website
              </Label>
            </div>
          </RadioGroup>

          {/* Escalation Phone (conditional) */}
          {unanswerableBehavior === "transfer" && (
            <div className="mt-3 pl-7">
              <Label className="text-sm font-medium mb-1.5 block">
                Escalation Phone Number
              </Label>
              <Input
                value={escalationPhone}
                onChange={(e) => setEscalationPhone(e.target.value)}
                placeholder="e.g. (555) 123-4567"
                className="text-sm max-w-xs"
              />
            </div>
          )}
        </div>

        <div className="border-t" />

        {/* Max Call Duration */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Max Call Duration</Label>
          <Select value={maxCallDuration} onValueChange={setMaxCallDuration}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 minutes</SelectItem>
              <SelectItem value="5">5 minutes</SelectItem>
              <SelectItem value="10">10 minutes</SelectItem>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="20">20 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
