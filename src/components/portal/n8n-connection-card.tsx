"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, RefreshCw, Check, GitBranch } from "lucide-react";
import { toast } from "sonner";

interface N8nConnectionCardProps {
  clientId: string;
}

export function N8nConnectionCard({ clientId }: N8nConnectionCardProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generateApiKey() {
    const randomPart = crypto.randomUUID().replace(/-/g, "");
    const key = `${clientId}:${randomPart}`;
    setApiKey(key);
    toast.success("API key generated! Copy it and paste into n8n.");
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
            <div className="h-7 w-7 rounded-md bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <GitBranch className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">n8n</h3>
              <p className="text-[11px] text-muted-foreground">
                Connect your account to n8n for automated workflows
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
              <Label htmlFor="n8n-api-key">Your API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="n8n-api-key"
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
              Use this API key in your n8n integration to connect your account.
              Paste it when setting up the Invaria Labs connection in n8n.
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
              Connect to n8n to create automated workflows triggered by call events.
              Self-hosted or cloud-based.
            </p>
            <Button onClick={generateApiKey} className="gap-2">
              <GitBranch className="h-4 w-4" />
              Generate API Key
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
