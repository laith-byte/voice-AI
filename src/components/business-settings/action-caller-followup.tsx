"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send } from "lucide-react";

interface ActionCallerFollowupProps {
  isEnabled: boolean;
  config: {
    subject?: string;
    body?: string;
    delay_minutes?: number; // 0, 15, 60, 480
  };
  onChange: (isEnabled: boolean, config: Record<string, unknown>) => void;
}

const DELAY_OPTIONS = [
  { value: "0", label: "Immediately" },
  { value: "15", label: "15 minutes" },
  { value: "60", label: "1 hour" },
  { value: "480", label: "Next morning" },
] as const;

export function ActionCallerFollowup({
  isEnabled,
  config,
  onChange,
}: ActionCallerFollowupProps) {
  const subject = config.subject ?? "";
  const body = config.body ?? "";
  const delayMinutes = config.delay_minutes ?? 15;

  function handleToggle(checked: boolean) {
    onChange(checked, config);
  }

  function handleSubjectChange(value: string) {
    onChange(isEnabled, { ...config, subject: value });
  }

  function handleBodyChange(value: string) {
    onChange(isEnabled, { ...config, body: value });
  }

  function handleDelayChange(value: string) {
    onChange(isEnabled, { ...config, delay_minutes: parseInt(value, 10) });
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Send className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Caller Follow-Up Email</h3>
              <p className="text-[11px] text-muted-foreground">
                Automatically email the caller after their call
              </p>
            </div>
          </div>
          <Switch checked={isEnabled} onCheckedChange={handleToggle} />
        </div>
      </div>

      {/* Form */}
      <CardContent
        className={`p-4 space-y-4 transition-opacity ${
          isEnabled ? "opacity-100" : "opacity-50 pointer-events-none"
        }`}
      >
        <p className="text-xs text-muted-foreground">
          Requires caller to provide their email during the call.
        </p>

        {/* Subject */}
        <div className="space-y-1.5">
          <Label htmlFor="caller-followup-subject" className="text-sm font-medium">
            Subject
          </Label>
          <Input
            id="caller-followup-subject"
            value={subject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            placeholder="Thanks for calling {{business_name}}!"
            className="text-sm"
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <Label htmlFor="caller-followup-body" className="text-sm font-medium">
            Body
          </Label>
          <Textarea
            id="caller-followup-body"
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            placeholder="Hi {{caller_name}}, thanks for calling us today. We appreciate your time and look forward to helping you!"
            className="text-sm min-h-[100px]"
          />
        </div>

        {/* Delay */}
        <div className="space-y-1.5">
          <Label htmlFor="caller-followup-delay" className="text-sm font-medium">
            Delay
          </Label>
          <Select
            value={String(delayMinutes)}
            onValueChange={handleDelayChange}
          >
            <SelectTrigger id="caller-followup-delay" className="w-full max-w-xs">
              <SelectValue placeholder="Select delay" />
            </SelectTrigger>
            <SelectContent>
              {DELAY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Template variables note */}
        <p className="text-[11px] text-muted-foreground">
          Available template variables:{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
            {"{{business_name}}"}
          </code>{" "}
          and{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
            {"{{caller_name}}"}
          </code>
        </p>
      </CardContent>
    </Card>
  );
}
