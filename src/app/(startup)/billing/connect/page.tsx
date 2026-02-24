"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { StripeConnectCard } from "@/components/billing/stripe-connect-card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function BillingConnectPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" /></div>}>
      <BillingConnectContent />
    </Suspense>
  );
}

function BillingConnectContent() {
  const searchParams = useSearchParams();
  const [isConnected, setIsConnected] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) return;

      setUserEmail(user.email ?? null);

      const { data: currentUser, error: userError } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (userError || !currentUser?.organization_id) return;

      setOrganizationId(currentUser.organization_id);

      const { data: connection, error: connError } = await supabase
        .from("stripe_connections")
        .select("stripe_account_id, is_connected")
        .eq("organization_id", currentUser.organization_id)
        .single();

      if (!connError && connection) {
        setIsConnected(connection.is_connected);
        setStripeAccountId(connection.stripe_account_id);
      } else {
        setIsConnected(false);
        setStripeAccountId(null);
      }
    } catch (error) {
      console.error("Failed to check Stripe connection:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle returning from Stripe OAuth
  useEffect(() => {
    const handleOAuthReturn = async () => {
      if (searchParams.get("connected") !== "true") return;

      // Mark connection as complete via API route
      const res = await fetch("/api/admin/stripe-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_connected" }),
      });

      if (!res.ok) {
        console.error("Failed to mark Stripe connection as complete");
      }

      // Re-check connection state
      await checkConnection();
    };

    handleOAuthReturn();
  }, [searchParams, checkConnection]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const handleConnect = async () => {
    if (!userEmail || !organizationId) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_connect_account", email: userEmail }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Upsert the stripe_connections row via API route
      const upsertRes = await fetch("/api/admin/stripe-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_connection",
          stripe_account_id: data.accountId,
          is_connected: false,
        }),
      });

      if (!upsertRes.ok) {
        const errData = await upsertRes.json();
        throw new Error(errData.error || "Failed to save connection");
      }

      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (error) {
      console.error("Failed to connect Stripe:", error);
      toast.error("Failed to connect Stripe account. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!organizationId) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/stripe-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect_keep_account" }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to disconnect");
      }

      setIsConnected(false);
      toast.success("Stripe account disconnected.");
    } catch (error) {
      console.error("Failed to disconnect Stripe:", error);
      toast.error("Failed to disconnect Stripe account.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!stripeAccountId) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_account_link", stripeAccountId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Redirect to Stripe onboarding to update account
      window.location.href = data.url;
    } catch (error) {
      console.error("Failed to update Stripe account:", error);
      toast.error("Failed to update Stripe account. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
      </div>
    );
  }

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
