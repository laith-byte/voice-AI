"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";

type Provider = "retell" | "elevenlabs" | "vapi" | "openai" | "salesforce" | "gohighlevel";

interface IntegrationRow {
  id: string;
  organization_id: string;
  provider: Provider;
  name: string;
  is_connected: boolean;
  connected_at: string | null;
}

const PROVIDER_META: Record<
  Provider,
  { name: string; description: string; icon: string; color: string }
> = {
  retell: {
    name: "Voice AI",
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
  salesforce: {
    name: "Salesforce",
    description: "CRM platform for contact and lead management",
    icon: "SF",
    color: "bg-sky-100 text-sky-600",
  },
  gohighlevel: {
    name: "GoHighLevel",
    description: "All-in-one CRM and marketing automation",
    icon: "GH",
    color: "bg-orange-100 text-orange-600",
  },
};

const ALL_PROVIDERS: Provider[] = ["retell", "elevenlabs", "vapi", "openai", "salesforce", "gohighlevel"];

export default function SettingsIntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogProvider, setDialogProvider] = useState<Provider | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [integrationToDisconnect, setIntegrationToDisconnect] = useState<string | null>(null);

  // Configure dialog state
  const [configOpen, setConfigOpen] = useState(false);
  const [configIntegration, setConfigIntegration] = useState<IntegrationRow | null>(null);
  const [configApiKey, setConfigApiKey] = useState("");
  const [configSaving, setConfigSaving] = useState(false);

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
        .select("id, organization_id, provider, name, is_connected, connected_at")
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

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: dialogProvider,
          name: PROVIDER_META[dialogProvider].name,
          api_key: apiKeyInput.trim(),
        }),
      });

      if (res.ok) {
        setDialogOpen(false);
        setApiKeyInput("");
        setDialogProvider(null);
        toast.success("Integration connected successfully.");
        await fetchIntegrations();
      } else {
        toast.error("Failed to connect integration. Please try again.");
      }
    } catch {
      toast.error("Failed to connect integration. Please check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    setDisconnecting(integrationId);

    try {
      const res = await fetch(`/api/integrations?id=${integrationId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Integration disconnected.");
        await fetchIntegrations();
      } else {
        toast.error("Failed to disconnect integration.");
      }
    } catch {
      toast.error("Failed to disconnect integration. Please check your connection.");
    } finally {
      setDisconnecting(null);
    }
  };

  const handleOpenConfigure = (integration: IntegrationRow) => {
    setConfigIntegration(integration);
    setConfigApiKey("");
    setConfigOpen(true);
  };

  const handleUpdateApiKey = async () => {
    if (!configIntegration || !configApiKey.trim()) return;
    setConfigSaving(true);
    try {
      const res = await fetch("/api/integrations/configure", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationId: configIntegration.id,
          api_key: configApiKey.trim(),
        }),
      });
      if (res.ok) {
        toast.success("API key updated successfully.");
        setConfigOpen(false);
      } else {
        toast.error("Failed to update API key.");
      }
    } catch {
      toast.error("Failed to update API key.");
    } finally {
      setConfigSaving(false);
    }
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
        <div className="border border-[#e5e7eb] rounded-lg min-h-[400px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
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
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => handleOpenConfigure(integration)}>
                        Configure
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => setIntegrationToDisconnect(integration.id)}
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

      {/* Configure Integration Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Configure {configIntegration ? PROVIDER_META[configIntegration.provider]?.name : ""}
            </DialogTitle>
            <DialogDescription>
              Update the API key for this integration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Current API Key</Label>
              <div className="flex items-center h-10 px-3 rounded-md border border-[#e5e7eb] bg-gray-50">
                <span className="text-sm text-[#6b7280] font-mono">{"*".repeat(32)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="config-api-key">New API Key</Label>
              <Input
                id="config-api-key"
                type="password"
                placeholder="Enter new API key..."
                value={configApiKey}
                onChange={(e) => setConfigApiKey(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              onClick={handleUpdateApiKey}
              disabled={!configApiKey.trim() || configSaving}
            >
              {configSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Integration Confirmation */}
      <AlertDialog open={!!integrationToDisconnect} onOpenChange={(open) => !open && setIntegrationToDisconnect(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Integration</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect the integration. You can reconnect it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (integrationToDisconnect) {
                  handleDisconnect(integrationToDisconnect);
                  setIntegrationToDisconnect(null);
                }
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
