"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createClient } from "@/lib/supabase/client";

export default function CampaignsPage() {
  const params = useParams();
  const agentId = params.id as string;
  const supabase = createClient();

  // Loading state
  const [loading, setLoading] = useState(true);

  // Config ID (for updates)
  const [configId, setConfigId] = useState<string | null>(null);

  const [rateMode, setRateMode] = useState<"min_max" | "fixed">("min_max");

  // Min/Max mode state
  const [minCalls, setMinCalls] = useState("1");
  const [maxCalls, setMaxCalls] = useState("10");
  const [minMinutes, setMinMinutes] = useState("1");
  const [maxMinutes, setMaxMinutes] = useState("30");

  // Fixed mode state
  const [fixedCalls, setFixedCalls] = useState("5");
  const [fixedMinutes, setFixedMinutes] = useState("15");

  // Auto-save state
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Track whether initial load is done (to avoid auto-save on mount)
  const [initialized, setInitialized] = useState(false);

  function formatTime(date: Date) {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  // Fetch config on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const { data, error } = await supabase
        .from("campaign_config")
        .select("*")
        .eq("agent_id", agentId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching campaign_config:", error);
      }

      if (data) {
        setConfigId(data.id);
        setRateMode(data.rate_mode === "fixed" ? "fixed" : "min_max");
        setMinCalls(String(data.min_calls));
        setMaxCalls(String(data.max_calls));
        setMinMinutes(String(data.min_minutes));
        setMaxMinutes(String(data.max_minutes));
        setFixedCalls(String(data.fixed_calls));
        setFixedMinutes(String(data.fixed_minutes));
      } else {
        // Create default row
        const { data: newConfig, error: insertError } = await supabase
          .from("campaign_config")
          .insert({
            agent_id: agentId,
            rate_mode: "min_max",
            min_calls: 1,
            max_calls: 10,
            min_minutes: 1,
            max_minutes: 30,
            fixed_calls: 5,
            fixed_minutes: 15,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating default campaign_config:", insertError);
        } else if (newConfig) {
          setConfigId(newConfig.id);
        }
      }

      setLoading(false);
      // Mark initialized after a short delay so the auto-save effect skips the first trigger
      setTimeout(() => setInitialized(true), 100);
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Auto-save effect
  useEffect(() => {
    if (!initialized || !configId) return;

    const timer = setTimeout(async () => {
      setSaving(true);

      const { error } = await supabase
        .from("campaign_config")
        .update({
          rate_mode: rateMode,
          min_calls: parseInt(minCalls) || 1,
          max_calls: parseInt(maxCalls) || 10,
          min_minutes: parseInt(minMinutes) || 1,
          max_minutes: parseInt(maxMinutes) || 30,
          fixed_calls: parseInt(fixedCalls) || 5,
          fixed_minutes: parseInt(fixedMinutes) || 15,
        })
        .eq("id", configId);

      if (error) {
        console.error("Error saving campaign_config:", error);
      }

      setLastSaved(formatTime(new Date()));
      setSaving(false);
    }, 800);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rateMode,
    minCalls,
    maxCalls,
    minMinutes,
    maxMinutes,
    fixedCalls,
    fixedMinutes,
    initialized,
    configId,
  ]);

  function clamp(value: string, min: number, max: number): string {
    const num = parseInt(value);
    if (isNaN(num)) return value;
    if (num < min) return min.toString();
    if (num > max) return max.toString();
    return num.toString();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6b7280]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#111827]">
            Calling Rate Configuration
          </h2>
          <p className="text-sm text-[#6b7280] mt-1">
            Configure the calling rate for outbound campaigns using this agent.
          </p>
        </div>

        {/* Auto-save indicator */}
        <div className="flex items-center gap-2 text-sm">
          {saving ? (
            <span className="text-[#6b7280]">Saving...</span>
          ) : lastSaved ? (
            <span className="flex items-center gap-1.5 text-[#6b7280]">
              <Check className="h-3.5 w-3.5 text-green-600" />
              Saved {lastSaved}
            </span>
          ) : null}
        </div>
      </div>

      {/* Rate Mode Selection */}
      <div className="border border-[#e5e7eb] rounded-lg p-6 space-y-6">
        <RadioGroup
          value={rateMode}
          onValueChange={(value) => setRateMode(value as "min_max" | "fixed")}
          className="flex gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="min_max" id="mode-minmax" />
            <Label htmlFor="mode-minmax" className="text-sm text-[#111827] font-medium">
              Min / Max
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="fixed" id="mode-fixed" />
            <Label htmlFor="mode-fixed" className="text-sm text-[#111827] font-medium">
              Fixed
            </Label>
          </div>
        </RadioGroup>

        {/* Min/Max Mode */}
        {rateMode === "min_max" && (
          <div className="space-y-6">
            {/* Calls per interval */}
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-3 block">
                Calls per Interval (1-20)
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-[#6b7280] mb-1.5 block">
                    Minimum
                  </Label>
                  <Input
                    type="number"
                    value={minCalls}
                    onChange={(e) => setMinCalls(e.target.value)}
                    onBlur={() => setMinCalls(clamp(minCalls, 1, 20))}
                    min={1}
                    max={20}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-[#6b7280] mb-1.5 block">
                    Maximum
                  </Label>
                  <Input
                    type="number"
                    value={maxCalls}
                    onChange={(e) => setMaxCalls(e.target.value)}
                    onBlur={() => setMaxCalls(clamp(maxCalls, 1, 20))}
                    min={1}
                    max={20}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Minutes per interval */}
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-3 block">
                Minutes per Interval (1-60)
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-[#6b7280] mb-1.5 block">
                    Minimum
                  </Label>
                  <Input
                    type="number"
                    value={minMinutes}
                    onChange={(e) => setMinMinutes(e.target.value)}
                    onBlur={() => setMinMinutes(clamp(minMinutes, 1, 60))}
                    min={1}
                    max={60}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-[#6b7280] mb-1.5 block">
                    Maximum
                  </Label>
                  <Input
                    type="number"
                    value={maxMinutes}
                    onChange={(e) => setMaxMinutes(e.target.value)}
                    onBlur={() => setMaxMinutes(clamp(maxMinutes, 1, 60))}
                    min={1}
                    max={60}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fixed Mode */}
        {rateMode === "fixed" && (
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
                Fixed Calls per Interval
              </Label>
              <Input
                type="number"
                value={fixedCalls}
                onChange={(e) => setFixedCalls(e.target.value)}
                onBlur={() => setFixedCalls(clamp(fixedCalls, 1, 20))}
                min={1}
                max={20}
                className="text-sm max-w-xs"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
                Fixed Minutes per Interval
              </Label>
              <Input
                type="number"
                value={fixedMinutes}
                onChange={(e) => setFixedMinutes(e.target.value)}
                onBlur={() => setFixedMinutes(clamp(fixedMinutes, 1, 60))}
                min={1}
                max={60}
                className="text-sm max-w-xs"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
