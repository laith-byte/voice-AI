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
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";

interface ActionEmailSummaryProps {
  isEnabled: boolean;
  config: {
    recipients?: string[];
    include_summary?: boolean;
    include_transcript?: boolean;
    include_caller_info?: boolean;
    include_recording?: boolean;
    trigger?: string; // "all" | "missed" | "completed"
  };
  onChange: (isEnabled: boolean, config: Record<string, unknown>) => void;
}

export function ActionEmailSummary({
  isEnabled,
  config,
  onChange,
}: ActionEmailSummaryProps) {
  const recipients = config.recipients ?? [];
  const recipientsValue = recipients.join(", ");

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <Mail className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Email Summary</h3>
              <p className="text-[11px] text-muted-foreground">
                Send a call summary to your email after every call
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
        {/* Recipients */}
        <div className="space-y-2">
          <Label htmlFor="email-recipients">Recipient(s)</Label>
          <Input
            id="email-recipients"
            type="text"
            placeholder="e.g. sarah@example.com, front@example.com"
            value={recipientsValue}
            onChange={(e) => {
              const parsed = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              onChange(isEnabled, {
                ...config,
                recipients: parsed,
              });
            }}
          />
          {recipients.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {recipients.map((email, i) => (
                <Badge key={i} variant="secondary" className="text-[11px]">
                  {email}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Include checkboxes */}
        <div className="space-y-2">
          <Label>Include</Label>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Checkbox
                id="include-summary"
                checked={config.include_summary ?? true}
                onCheckedChange={(checked) =>
                  onChange(isEnabled, {
                    ...config,
                    include_summary: checked === true,
                  })
                }
              />
              <Label
                htmlFor="include-summary"
                className="text-sm font-normal cursor-pointer"
              >
                Summary
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="include-transcript"
                checked={config.include_transcript ?? true}
                onCheckedChange={(checked) =>
                  onChange(isEnabled, {
                    ...config,
                    include_transcript: checked === true,
                  })
                }
              />
              <Label
                htmlFor="include-transcript"
                className="text-sm font-normal cursor-pointer"
              >
                Full transcript
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="include-caller-info"
                checked={config.include_caller_info ?? true}
                onCheckedChange={(checked) =>
                  onChange(isEnabled, {
                    ...config,
                    include_caller_info: checked === true,
                  })
                }
              />
              <Label
                htmlFor="include-caller-info"
                className="text-sm font-normal cursor-pointer"
              >
                Caller info
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="include-recording"
                checked={config.include_recording ?? false}
                onCheckedChange={(checked) =>
                  onChange(isEnabled, {
                    ...config,
                    include_recording: checked === true,
                  })
                }
              />
              <Label
                htmlFor="include-recording"
                className="text-sm font-normal cursor-pointer"
              >
                Recording link
              </Label>
            </div>
          </div>
        </div>

        {/* Trigger */}
        <div className="space-y-2">
          <Label htmlFor="email-trigger">Trigger</Label>
          <Select
            value={config.trigger ?? "all"}
            onValueChange={(value) =>
              onChange(isEnabled, {
                ...config,
                trigger: value,
              })
            }
          >
            <SelectTrigger id="email-trigger">
              <SelectValue placeholder="Select trigger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All calls</SelectItem>
              <SelectItem value="missed">Missed calls only</SelectItem>
              <SelectItem value="completed">Completed calls only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
