"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import type { Agent } from "@/types/database";

export default function AgentOverviewPage() {
  const params = useParams();
  const id = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncMethod, setSyncMethod] = useState("webhook");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchAgent = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Failed to fetch agent:", error);
      setLoading(false);
      return;
    }

    setAgent(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  function handleCopy(value: string, field: string) {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function CopyButton({ value, field }: { value: string; field: string }) {
    return (
      <button
        onClick={() => handleCopy(value, field)}
        className="text-[#6b7280] hover:text-[#111827] transition-colors"
        title="Copy to clipboard"
      >
        {copiedField === field ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6b7280]" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="space-y-8 max-w-3xl">
        <p className="text-[#6b7280]">Agent not found.</p>
      </div>
    );
  }

  const retellApiKey = agent.retell_api_key_encrypted;
  const agentId = agent.retell_agent_id;
  const kbId = agent.knowledge_base_id ?? "";
  const kbName = agent.knowledge_base_name ?? "";
  const webhookUrl = agent.webhook_url ?? "";

  const maskedApiKey =
    retellApiKey.length > 8
      ? retellApiKey.slice(0, 7) + "****" + retellApiKey.slice(-4)
      : "****";

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Data Sync Method */}
      <section>
        <h2 className="text-lg font-semibold text-[#111827] mb-1">
          Data Sync Method
        </h2>
        <p className="text-sm text-[#6b7280] mb-4">
          Choose how this agent syncs call data with the platform.
        </p>
        <RadioGroup
          value={syncMethod}
          onValueChange={setSyncMethod}
          className="flex gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="webhook" id="sync-webhook" />
            <Label htmlFor="sync-webhook" className="text-sm text-[#111827]">
              Webhook (real-time)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="periodic" id="sync-periodic" />
            <Label htmlFor="sync-periodic" className="text-sm text-[#111827]">
              Periodic sync
            </Label>
          </div>
        </RadioGroup>
      </section>

      <Separator />

      {/* Credentials */}
      <section>
        <h2 className="text-lg font-semibold text-[#111827] mb-1">
          Credentials
        </h2>
        <p className="text-sm text-[#6b7280] mb-4">
          Platform credentials and identifiers for this agent.
        </p>

        <div className="space-y-4">
          {/* Retell API Key */}
          <div>
            <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
              Retell API Key
            </Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  readOnly
                  value={apiKeyVisible ? retellApiKey : maskedApiKey}
                  className="font-mono text-sm pr-20"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    onClick={() => setApiKeyVisible(!apiKeyVisible)}
                    className="text-[#6b7280] hover:text-[#111827] transition-colors p-1"
                    title={apiKeyVisible ? "Hide" : "Show"}
                  >
                    {apiKeyVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  <CopyButton value={retellApiKey} field="api-key" />
                </div>
              </div>
            </div>
          </div>

          {/* Agent ID */}
          <div>
            <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
              Agent ID
            </Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  readOnly
                  value={agentId}
                  className="font-mono text-sm pr-10"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <CopyButton value={agentId} field="agent-id" />
                </div>
              </div>
            </div>
          </div>

          {/* KB Integration */}
          <div>
            <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
              Knowledge Base Integration
            </Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  readOnly
                  value={kbId}
                  className="font-mono text-sm"
                />
              </div>
              {kbName && (
                <Badge
                  variant="secondary"
                  className="bg-gray-100 text-[#111827] border border-[#e5e7eb] shrink-0"
                >
                  {kbName}
                </Badge>
              )}
              {kbId && <CopyButton value={kbId} field="kb-id" />}
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* Webhook URL */}
      <section>
        <h2 className="text-lg font-semibold text-[#111827] mb-1">
          Webhook URL
        </h2>
        <p className="text-sm text-[#6b7280] mb-4">
          Configure the webhook endpoint that receives call events from Retell.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Input
              readOnly
              value={webhookUrl}
              className="font-mono text-sm pr-10"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {webhookUrl && <CopyButton value={webhookUrl} field="webhook-url" />}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
