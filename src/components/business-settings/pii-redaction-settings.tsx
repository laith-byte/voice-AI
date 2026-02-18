"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PiiRedactionSettingsProps {
  clientId?: string;
}

interface PiiConfig {
  enabled: boolean;
  redact_phone_numbers: boolean;
  redact_emails: boolean;
  redact_ssn: boolean;
  redact_credit_cards: boolean;
  redact_names: boolean;
}

const DEFAULT_CONFIG: PiiConfig = {
  enabled: false,
  redact_phone_numbers: true,
  redact_emails: true,
  redact_ssn: true,
  redact_credit_cards: true,
  redact_names: false,
};

function apiUrl(clientId?: string) {
  const base = "/api/pii-redaction";
  return clientId ? `${base}?client_id=${clientId}` : base;
}

export function PiiRedactionSettings({ clientId }: PiiRedactionSettingsProps) {
  const [config, setConfig] = useState<PiiConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(clientId));
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setConfig({
        enabled: data.enabled ?? false,
        redact_phone_numbers: data.redact_phone_numbers ?? true,
        redact_emails: data.redact_emails ?? true,
        redact_ssn: data.redact_ssn ?? true,
        redact_credit_cards: data.redact_credit_cards ?? true,
        redact_names: data.redact_names ?? false,
      });
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function saveConfig(updated: PiiConfig) {
    setConfig(updated);
    setSaving(true);
    try {
      const res = await fetch(apiUrl(clientId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("PII redaction settings saved", { duration: 2000 });
    } catch {
      toast.error("Failed to save PII redaction settings");
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
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight">PII Redaction</h2>
          <p className="text-xs text-muted-foreground">
            Automatically redact sensitive information from call transcripts.
          </p>
        </div>
        {saving && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Enable PII Redaction</h3>
                <p className="text-[11px] text-muted-foreground">
                  Redact personally identifiable information from transcripts
                </p>
              </div>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) =>
                saveConfig({ ...config, enabled: checked })
              }
            />
          </div>
        </div>

        <CardContent
          className={`space-y-4 pt-4 transition-opacity ${
            config.enabled ? "opacity-100" : "opacity-50 pointer-events-none"
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="redact-phone" className="text-sm font-normal cursor-pointer">
                Redact Phone Numbers
              </Label>
              <Switch
                id="redact-phone"
                checked={config.redact_phone_numbers}
                onCheckedChange={(checked) =>
                  saveConfig({ ...config, redact_phone_numbers: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="redact-email" className="text-sm font-normal cursor-pointer">
                Redact Email Addresses
              </Label>
              <Switch
                id="redact-email"
                checked={config.redact_emails}
                onCheckedChange={(checked) =>
                  saveConfig({ ...config, redact_emails: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="redact-ssn" className="text-sm font-normal cursor-pointer">
                Redact Social Security Numbers
              </Label>
              <Switch
                id="redact-ssn"
                checked={config.redact_ssn}
                onCheckedChange={(checked) =>
                  saveConfig({ ...config, redact_ssn: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="redact-cc" className="text-sm font-normal cursor-pointer">
                Redact Credit Card Numbers
              </Label>
              <Switch
                id="redact-cc"
                checked={config.redact_credit_cards}
                onCheckedChange={(checked) =>
                  saveConfig({ ...config, redact_credit_cards: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="redact-names" className="text-sm font-normal cursor-pointer">
                Redact Names
              </Label>
              <Switch
                id="redact-names"
                checked={config.redact_names}
                onCheckedChange={(checked) =>
                  saveConfig({ ...config, redact_names: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
