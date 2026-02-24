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
import { BarChart3 } from "lucide-react";

interface ActionDailyDigestProps {
  isEnabled: boolean;
  config: {
    recipients?: string[];
    send_at_hour?: number; // 0-23
    include_count?: boolean;
    include_avg_duration?: boolean;
    include_missed?: boolean;
    include_topics?: boolean;
    include_transcripts?: boolean;
  };
  onChange: (isEnabled: boolean, config: Record<string, unknown>) => void;
}

const HOUR_OPTIONS = Array.from({ length: 17 }, (_, i) => {
  const hour = i + 6; // 6 AM to 10 PM
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour;
  return { value: hour, label: `${displayHour}:00 ${period}` };
});

export function ActionDailyDigest({
  isEnabled,
  config,
  onChange,
}: ActionDailyDigestProps) {
  const recipientsString = (config.recipients ?? []).join(", ");

  function handleRecipientsChange(value: string) {
    const recipients = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onChange(isEnabled, { ...config, recipients });
  }

  function handleHourChange(value: string) {
    onChange(isEnabled, { ...config, send_at_hour: parseInt(value, 10) });
  }

  function handleCheckboxChange(
    key: string,
    checked: boolean | "indeterminate"
  ) {
    onChange(isEnabled, { ...config, [key]: checked === true });
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Daily Digest</h3>
              <p className="text-[11px] text-muted-foreground">
                Get a daily summary of all calls at the end of each business day
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
          <Label htmlFor="digest-recipients">Recipient(s)</Label>
          <Input
            id="digest-recipients"
            type="text"
            placeholder="sarah@southbaydental.com, front-desk@southbaydental.com"
            value={recipientsString}
            onChange={(e) => handleRecipientsChange(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Separate multiple email addresses with commas
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="digest-send-at">Send at</Label>
          <Select
            value={String(config.send_at_hour ?? 18)}
            onValueChange={handleHourChange}
          >
            <SelectTrigger id="digest-send-at">
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent>
              {HOUR_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>Include</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="digest-include-count"
                checked={config.include_count ?? true}
                onCheckedChange={(checked) =>
                  handleCheckboxChange("include_count", checked)
                }
              />
              <Label
                htmlFor="digest-include-count"
                className="text-sm font-normal cursor-pointer"
              >
                Call count
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="digest-include-avg-duration"
                checked={config.include_avg_duration ?? true}
                onCheckedChange={(checked) =>
                  handleCheckboxChange("include_avg_duration", checked)
                }
              />
              <Label
                htmlFor="digest-include-avg-duration"
                className="text-sm font-normal cursor-pointer"
              >
                Average duration
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="digest-include-missed"
                checked={config.include_missed ?? true}
                onCheckedChange={(checked) =>
                  handleCheckboxChange("include_missed", checked)
                }
              />
              <Label
                htmlFor="digest-include-missed"
                className="text-sm font-normal cursor-pointer"
              >
                Missed calls
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="digest-include-topics"
                checked={config.include_topics ?? true}
                onCheckedChange={(checked) =>
                  handleCheckboxChange("include_topics", checked)
                }
              />
              <Label
                htmlFor="digest-include-topics"
                className="text-sm font-normal cursor-pointer"
              >
                Key topics
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="digest-include-transcripts"
                checked={config.include_transcripts ?? false}
                onCheckedChange={(checked) =>
                  handleCheckboxChange("include_transcripts", checked)
                }
              />
              <Label
                htmlFor="digest-include-transcripts"
                className="text-sm font-normal cursor-pointer"
              >
                Full transcripts
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
