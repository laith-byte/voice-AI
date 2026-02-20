"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  CreditCard,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

      // Upsert stripe_connections row
      const { data: dbUser } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (!dbUser) throw new Error("User not found");

      await supabase.from("stripe_connections").upsert(
        {
          organization_id: dbUser.organization_id,
          stripe_account_id: accountId,
          is_connected: false,
        },
        { onConflict: "organization_id" }
      );

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
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: dbUser } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (!dbUser) throw new Error("User not found");

      const { error } = await supabase
        .from("stripe_connections")
        .update({
          is_connected: false,
          stripe_account_id: null,
          connected_at: null,
        })
        .eq("organization_id", dbUser.organization_id);

      if (error) throw error;

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

        await supabase
          .from("stripe_connections")
          .update({
            is_connected: true,
            connected_at: new Date().toISOString(),
          })
          .eq("organization_id", dbUser.organization_id);

        setIsConnected(true);
        toast.success("Stripe account connected successfully!");
        // Clean the URL
        window.history.replaceState({}, "", window.location.pathname);
      })();
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
        <p className="text-sm text-yellow-800">
          Please do not create, edit or delete packages/products directly from
          Stripe Dashboard. All product and subscription management should be
          done through this interface to ensure data consistency.
        </p>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  isConnected ? "bg-green-50" : "bg-gray-100"
                }`}
              >
                <CreditCard
                  className={`h-6 w-6 ${
                    isConnected ? "text-green-600" : "text-[#6b7280]"
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-medium text-[#111827]">
                    Stripe Account
                  </h3>
                  {isConnected && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </div>
                <p className="text-sm text-[#6b7280] mt-0.5">
                  {isConnected
                    ? "Your Stripe account is connected and ready to go!"
                    : "Connect your Stripe account to start accepting payments."}
                </p>
                {isConnected && stripeAccountId && (
                  <p className="text-xs text-[#6b7280] mt-1 font-mono">
                    {stripeAccountId}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-6">
            {isConnected ? (
              <>
                <Button
                  className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                  onClick={handleUpdate}
                  disabled={connecting}
                >
                  {connecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Stripe Account"
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Disconnect Stripe Account
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect Stripe Account"
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
