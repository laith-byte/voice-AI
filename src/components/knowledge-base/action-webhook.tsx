"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Webhook } from "lucide-react";

interface ActionWebhookProps {
  isEnabled: boolean;
  config: {
    url?: string;
    events?: string[]; // ["completed", "missed"]
    format?: string; // "json"
  };
  onChange: (isEnabled: boolean, config: Record<string, unknown>) => void;
}

const EVENT_OPTIONS = [
  { value: "completed", label: "Call completed" },
  { value: "missed", label: "Call missed" },
] as const;

export function ActionWebhook({
  isEnabled,
  config,
  onChange,
}: ActionWebhookProps) {
  const events = config.events ?? [];

  function handleEventToggle(eventValue: string, checked: boolean) {
    const updatedEvents = checked
      ? [...events, eventValue]
      : events.filter((e) => e !== eventValue);
    onChange(isEnabled, {
      ...config,
      events: updatedEvents,
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <Webhook className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Webhook{" "}
                <span className="text-[10px] font-normal text-muted-foreground ml-1">
                  Advanced
                </span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Send call data to an external URL for Zapier, Make, or custom
                systems
              </p>
            </div>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={(checked) => onChange(checked, config)}
          />
        </div>
      </div>

      <CardContent
        className={`space-y-4 pt-4 transition-opacity ${
          isEnabled ? "opacity-100" : "opacity-50 pointer-events-none"
        }`}
      >
        <div className="space-y-2">
          <Label htmlFor="webhook-url">URL</Label>
          <Input
            id="webhook-url"
            type="url"
            placeholder="https://hooks.zapier.com/hooks/catch/123456/abcdef"
            value={config.url ?? ""}
            onChange={(e) =>
              onChange(isEnabled, {
                ...config,
                url: e.target.value,
              })
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Events</Label>
          <div className="flex flex-wrap gap-4">
            {EVENT_OPTIONS.map((event) => (
              <div key={event.value} className="flex items-center gap-2">
                <Checkbox
                  id={`webhook-event-${event.value}`}
                  checked={events.includes(event.value)}
                  onCheckedChange={(checked) =>
                    handleEventToggle(event.value, !!checked)
                  }
                />
                <Label
                  htmlFor={`webhook-event-${event.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {event.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="webhook-format">Format</Label>
          <Select
            value={config.format ?? "json"}
            onValueChange={(value) =>
              onChange(isEnabled, {
                ...config,
                format: value,
              })
            }
          >
            <SelectTrigger id="webhook-format">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
