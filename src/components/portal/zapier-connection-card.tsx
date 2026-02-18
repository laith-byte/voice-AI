"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, Copy, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";

interface ZapierConnectionCardProps {
  clientId: string;
}

export function ZapierConnectionCard({ clientId }: ZapierConnectionCardProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generateApiKey() {
    const randomPart = crypto.randomUUID().replace(/-/g, "");
    const key = `${clientId}:${randomPart}`;
    setApiKey(key);
    toast.success("API key generated! Copy it and paste into Zapier.");
  }

  async function copyToClipboard() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast.success("API key copied to clipboard", { duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Zapier</h3>
              <p className="text-[11px] text-muted-foreground">
                Connect your account to Zapier for automated workflows
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            Integration
          </Badge>
        </div>
      </div>

      <CardContent className="space-y-4 pt-4">
        {apiKey ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="zapier-api-key">Your API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="zapier-api-key"
                  value={apiKey}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Use this API key in your Zapier integration to connect your account.
              Paste it when setting up the Invaria Labs connection in Zapier.
            </p>

            <Button
              variant="ghost"
              size="sm"
              onClick={generateApiKey}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Regenerate Key
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Generate an API key to connect your account with Zapier. This allows
              you to create automated workflows triggered by call events.
            </p>
            <Button onClick={generateApiKey} className="gap-2">
              <Zap className="h-4 w-4" />
              Generate API Key
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
