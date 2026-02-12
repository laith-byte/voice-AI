"use client";

import { useState, useEffect } from "react";
import { Loader2, Lock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Channel {
  id: string;
  name: string;
  is_private: boolean;
}

interface SlackChannelPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
}

export function SlackChannelPicker({
  label,
  value,
  onChange,
  required,
  placeholder,
  error,
}: SlackChannelPickerProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChannels() {
      setLoading(true);
      try {
        const res = await fetch("/api/oauth/slack/channels");
        if (res.ok) {
          const data = await res.json();
          setChannels(data.channels || []);
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    fetchChannels();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading channels...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder || "Select a channel"} />
        </SelectTrigger>
        <SelectContent>
          {channels.map((ch) => (
            <SelectItem key={ch.id!} value={ch.id!}>
              <span className="flex items-center gap-1.5">
                {ch.is_private && <Lock className="h-3 w-3 text-muted-foreground" />}
                #{ch.name}
              </span>
            </SelectItem>
          ))}
          {channels.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground">
              No channels found
            </div>
          )}
        </SelectContent>
      </Select>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
