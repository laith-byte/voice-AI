"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare } from "lucide-react";

interface ActionSmsNotificationProps {
  isEnabled: boolean;
  config: {
    phone_number?: string;
    trigger?: string; // "all" | "missed" | "completed"
  };
  onChange: (isEnabled: boolean, config: Record<string, unknown>) => void;
}

export function ActionSmsNotification({
  isEnabled,
  config,
  onChange,
}: ActionSmsNotificationProps) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">SMS Notification</h3>
              <p className="text-[11px] text-muted-foreground">
                Get a text message alert when you receive a call
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
          <Label htmlFor="sms-phone-number">Phone number</Label>
          <Input
            id="sms-phone-number"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={config.phone_number ?? ""}
            onChange={(e) =>
              onChange(isEnabled, {
                ...config,
                phone_number: e.target.value,
              })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sms-trigger">Trigger</Label>
          <Select
            value={config.trigger ?? "missed"}
            onValueChange={(value) =>
              onChange(isEnabled, {
                ...config,
                trigger: value,
              })
            }
          >
            <SelectTrigger id="sms-trigger">
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
