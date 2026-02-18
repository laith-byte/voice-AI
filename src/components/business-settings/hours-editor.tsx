"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface DayHours {
  day: string;
  open: string;
  close: string;
  status: "open" | "closed";
}

interface HoursEditorProps {
  clientId?: string;
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
];

const DEFAULT_HOURS: DayHours[] = DAYS.map((day) => ({
  day,
  open: day === "Saturday" || day === "Sunday" ? "" : "9:00 AM",
  close: day === "Saturday" || day === "Sunday" ? "" : "5:00 PM",
  status: day === "Saturday" || day === "Sunday" ? "closed" : "open",
}));

// Convert "9:00 AM" to "09:00:00" for Postgres TIME
function parseTimeToDb(time: string): string | null {
  if (!time || !time.trim()) return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return time; // fallback: pass as-is
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3]?.toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}:00`;
}

// Convert "09:00:00" from Postgres to "9:00 AM" for display
function formatTimeForDisplay(time: string): string {
  if (!time) return "";
  const [hStr, m] = time.split(":");
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function apiUrl(path: string, clientId?: string) {
  const base = `/api/business-settings${path}`;
  return clientId ? `${base}?client_id=${clientId}` : base;
}

export function HoursEditor({ clientId }: HoursEditorProps) {
  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);
  const [timezone, setTimezone] = useState("America/New_York");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchHours = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/hours", clientId));
      if (!res.ok) throw new Error("Failed to fetch hours");
      const data = await res.json();
      // API returns array of { day_of_week, is_open, open_time, close_time }
      if (Array.isArray(data) && data.length > 0) {
        const mapped = DAYS.map((day, i) => {
          const row = data.find((r: { day_of_week: number }) => r.day_of_week === i);
          if (row) {
            return {
              day,
              open: row.open_time ? formatTimeForDisplay(row.open_time) : "",
              close: row.close_time ? formatTimeForDisplay(row.close_time) : "",
              status: row.is_open ? "open" as const : "closed" as const,
            };
          }
          return DEFAULT_HOURS[i];
        });
        setHours(mapped);
      }
      // Also fetch timezone from main business_settings
      const settingsRes = await fetch(apiUrl("", clientId));
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings?.timezone) setTimezone(settings.timezone);
      }
    } catch {
      // Use defaults if fetch fails (new client with no hours set)
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchHours();
  }, [fetchHours]);

  function updateDay(index: number, field: keyof DayHours, value: string) {
    setHours((prev) =>
      prev.map((h, i) => {
        if (i !== index) return h;
        const updated = { ...h, [field]: value };
        // When toggling to "closed", clear the time fields
        if (field === "status" && value === "closed") {
          updated.open = "";
          updated.close = "";
        }
        // When toggling to "open", set defaults if empty
        if (field === "status" && value === "open") {
          if (!updated.open) updated.open = "9:00 AM";
          if (!updated.close) updated.close = "5:00 PM";
        }
        return updated;
      })
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Transform UI format to DB format
      const dbHours = hours.map((h, i) => ({
        day_of_week: i,
        is_open: h.status === "open",
        open_time: h.status === "open" ? parseTimeToDb(h.open) : null,
        close_time: h.status === "open" ? parseTimeToDb(h.close) : null,
      }));

      const res = await fetch(apiUrl("/hours", clientId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dbHours),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? "Failed to save hours");
      }

      // Also save timezone to main business_settings
      const tzRes = await fetch(apiUrl("", clientId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });
      if (!tzRes.ok) {
        throw new Error("Hours saved but failed to save timezone");
      }

      toast.success("Business hours saved successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save hours"
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
          <div className="h-7 w-7 rounded-md bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Business Hours</h3>
            <p className="text-[11px] text-muted-foreground">
              Set your operating hours for each day of the week
            </p>
          </div>
        </div>
      </div>
      <CardContent className="p-4 space-y-4">
        {/* Timezone Selector */}
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium shrink-0">Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hours Grid */}
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[120px_1fr_1fr_100px] gap-3 px-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Day
            </span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Open
            </span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Close
            </span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Status
            </span>
          </div>

          {/* Day Rows */}
          {hours.map((day, index) => (
            <div
              key={day.day}
              className={`grid grid-cols-[120px_1fr_1fr_100px] gap-3 items-center rounded-lg px-1 py-1.5 transition-colors ${
                day.status === "closed"
                  ? "bg-muted/30"
                  : "hover:bg-muted/50"
              }`}
            >
              <span className={`text-sm font-medium ${day.status === "closed" ? "text-muted-foreground" : ""}`}>
                {day.day}
              </span>
              {day.status === "closed" ? (
                <span className="col-span-2 text-sm text-muted-foreground italic px-3">
                  Closed
                </span>
              ) : (
                <>
                  <Input
                    value={day.open}
                    onChange={(e) => updateDay(index, "open", e.target.value)}
                    placeholder="9:00 AM"
                    className="text-sm h-8"
                  />
                  <Input
                    value={day.close}
                    onChange={(e) => updateDay(index, "close", e.target.value)}
                    placeholder="5:00 PM"
                    className="text-sm h-8"
                  />
                </>
              )}
              <Select
                value={day.status}
                onValueChange={(value) =>
                  updateDay(index, "status", value as "open" | "closed")
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Hours
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
