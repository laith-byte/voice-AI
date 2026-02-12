"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OAuthConnection {
  provider: string;
  provider_email: string | null;
}

interface OAuthConnectButtonProps {
  provider: string;
  clientId: string;
  connection?: OAuthConnection | null;
  onDisconnected?: () => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  slack: "Slack",
  hubspot: "HubSpot",
};

export function OAuthConnectButton({
  provider,
  clientId,
  connection,
  onDisconnected,
}: OAuthConnectButtonProps) {
  const [disconnecting, setDisconnecting] = useState(false);

  const label = PROVIDER_LABELS[provider] || provider;

  function handleConnect() {
    const params = new URLSearchParams({
      provider,
      client_id: clientId,
      redirect: window.location.pathname,
    });
    window.location.href = `/api/oauth/authorize?${params}`;
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/oauth/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (res.ok) {
        onDisconnected?.();
      }
    } finally {
      setDisconnecting(false);
    }
  }

  if (connection) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Connected to {label}</p>
            {connection.provider_email && (
              <p className="text-xs text-muted-foreground truncate">
                {connection.provider_email}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          disabled={disconnecting}
        >
          {disconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Unlink className="h-4 w-4" />
          )}
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" className="w-full" onClick={handleConnect}>
      Connect with {label}
    </Button>
  );
}
