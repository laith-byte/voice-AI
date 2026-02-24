"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { StripeConnectCard } from "@/components/billing/stripe-connect-card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function SaaSConnectPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchConnectionStatus = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: dbUser } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (!dbUser) return;

      const { data: connection } = await supabase
        .from("stripe_connections")
        .select("*")
        .eq("organization_id", dbUser.organization_id)
        .single();

      if (connection) {
        setIsConnected(connection.is_connected);
        setStripeAccountId(connection.stripe_account_id);
      } else {
        setIsConnected(false);
        setStripeAccountId(null);
      }
    } catch {
      // no connection row yet
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectionStatus();
  }, [fetchConnectionStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_connect_account",
          email: user.email,
        }),
      });

      if (!res.ok) throw new Error("Failed to create connect account");

      const { accountId, url } = await res.json();

      // Upsert stripe_connections row via API route
      const upsertRes = await fetch("/api/admin/stripe-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_connection",
          stripe_account_id: accountId,
          is_connected: false,
        }),
      });

      if (!upsertRes.ok) {
        const errData = await upsertRes.json();
        throw new Error(errData.error || "Failed to save connection");
      }

      // Redirect to Stripe onboarding
      window.location.href = url;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to connect Stripe account"
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/admin/stripe-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to disconnect");
      }

      setIsConnected(false);
      setStripeAccountId(null);
      toast.success("Stripe account disconnected");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to disconnect Stripe account"
      );
    } finally {
      setDisconnecting(false);
    }
  };

  const handleUpdate = async () => {
    setConnecting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_account_link",
          stripeAccountId,
        }),
      });

      if (!res.ok) throw new Error("Failed to update connect account");

      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update Stripe account"
      );
    } finally {
      setConnecting(false);
    }
  };

  // Mark connection as complete if redirected back with ?connected=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      (async () => {
        const res = await fetch("/api/admin/stripe-connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_connected" }),
        });

        if (res.ok) {
          setIsConnected(true);
          toast.success("Stripe account connected successfully!");
        }
        // Clean the URL
        window.history.replaceState({}, "", window.location.pathname);
      })();
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
        </div>
      </div>
    );
  }

  const actionLoading = connecting || disconnecting;

  return (
    <StripeConnectCard
      isConnected={isConnected}
      stripeAccountId={stripeAccountId}
      actionLoading={actionLoading}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onUpdate={handleUpdate}
    />
  );
}
