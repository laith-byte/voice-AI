"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

type Provider = "retell" | "elevenlabs" | "vapi" | "openai";

interface IntegrationRow {
  id: string;
  organization_id: string;
  provider: Provider;
  name: string;
  api_key_encrypted: string;
  is_connected: boolean;
  connected_at: string | null;
}

const PROVIDER_META: Record<
  Provider,
  { name: string; description: string; icon: string; color: string }
> = {
  retell: {
    name: "Retell",
    description: "AI-powered voice agents for phone calls",
    icon: "R",
    color: "bg-indigo-100 text-indigo-600",
  },
  elevenlabs: {
    name: "ElevenLabs",
    description: "Advanced text-to-speech and voice cloning",
    icon: "E",
    color: "bg-emerald-100 text-emerald-600",
  },
  vapi: {
    name: "Vapi",
    description: "Voice AI platform for building voice agents",
    icon: "V",
    color: "bg-blue-100 text-blue-600",
  },
  openai: {
    name: "OpenAI",
    description: "GPT models for natural language processing",
    icon: "O",
    color: "bg-gray-800 text-white",
  },
};

const ALL_PROVIDERS: Provider[] = ["retell", "elevenlabs", "vapi", "openai"];

export default function SettingsIntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogProvider, setDialogProvider] = useState<Provider | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    const supabase = createClient();
    try {
      // 1. Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Get user's organization_id
      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (!userData?.organization_id) return;

      setOrgId(userData.organization_id);

      // 3. Fetch integrations for this org
      const { data, error } = await supabase
        .from("integrations")
        .select("id, organization_id, provider, name, api_key_encrypted, is_connected, connected_at")
        .eq("organization_id", userData.organization_id);

      if (!error && data) {
        setIntegrations(data as IntegrationRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleAddIntegration = async () => {
    if (!orgId || !dialogProvider || !apiKeyInput.trim()) return;
    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase.from("integrations").insert({
      organization_id: orgId,
      provider: dialogProvider,
      name: PROVIDER_META[dialogProvider].name,
      api_key_encrypted: apiKeyInput.trim(),
      is_connected: true,
      connected_at: new Date().toISOString(),
    });

    if (!error) {
      setDialogOpen(false);
      setApiKeyInput("");
      setDialogProvider(null);
      await fetchIntegrations();
    }
    setSaving(false);
  };

  const handleDisconnect = async (integrationId: string) => {
    setDisconnecting(integrationId);
    const supabase = createClient();

    const { error } = await supabase
      .from("integrations")
      .delete()
      .eq("id", integrationId);

    if (!error) {
      await fetchIntegrations();
    }
    setDisconnecting(null);
  };

  const getIntegrationForProvider = (provider: Provider): IntegrationRow | undefined => {
    return integrations.find((i) => i.provider === provider);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-[#6b7280]">
          Connect external accounts for a more streamlined experience.
        </p>
        <div className="border border-[#e5e7eb] rounded-lg py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Description */}
      <p className="text-sm text-[#6b7280]">
        Connect external accounts for a more streamlined experience.
      </p>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ALL_PROVIDERS.map((provider) => {
          const meta = PROVIDER_META[provider];
          const integration = getIntegrationForProvider(provider);
          const connected = !!integration?.is_connected;

          return (
            <Card key={provider}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${meta.color}`}
                    >
                      {meta.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-[#111827]">
                          {meta.name}
                        </h3>
                        {connected && (
                          <Badge
                            variant="secondary"
                            className="bg-green-50 text-green-700 border border-green-200"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[#6b7280] mt-1">
                        {meta.description}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  {connected && integration ? (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="text-xs">
                        Configure
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => handleDisconnect(integration.id)}
                        disabled={disconnecting === integration.id}
                      >
                        {disconnecting === integration.id ? (
                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        ) : null}
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setDialogProvider(provider);
                        setApiKeyInput("");
                        setDialogOpen(true);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1.5" />
                      Add Integration
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Integration Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {dialogProvider ? PROVIDER_META[dialogProvider].name : ""} Integration
            </DialogTitle>
            <DialogDescription>
              Enter your API key to connect{" "}
              {dialogProvider ? PROVIDER_META[dialogProvider].name : "this provider"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your API key..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              onClick={handleAddIntegration}
              disabled={!apiKeyInput.trim() || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
