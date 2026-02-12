"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface CalendarItem {
  id: string;
  name: string;
  primary: boolean;
}

interface GoogleCalendarPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
}

export function GoogleCalendarPicker({
  label,
  value,
  onChange,
  required,
  placeholder,
  error,
}: GoogleCalendarPickerProps) {
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCalendars() {
      setLoading(true);
      try {
        const res = await fetch("/api/oauth/google/calendars");
        if (res.ok) {
          const data = await res.json();
          setCalendars(data.calendars || []);
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    fetchCalendars();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading calendars...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder || "Select a calendar"} />
        </SelectTrigger>
        <SelectContent>
          {calendars.map((cal) => (
            <SelectItem key={cal.id!} value={cal.id!}>
              {cal.name}{cal.primary ? " (Primary)" : ""}
            </SelectItem>
          ))}
          {calendars.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground">
              No calendars found
            </div>
          )}
        </SelectContent>
      </Select>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
