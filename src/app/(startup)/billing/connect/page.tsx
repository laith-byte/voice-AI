"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Trash2, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function BillingConnectPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#6b7280]" /></div>}>
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

      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) return;

      const { data: currentUser } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (!currentUser?.organization_id) return;

      // Check if a connection row exists
      const { data: existing } = await supabase
        .from("stripe_connections")
        .select("id")
        .eq("organization_id", currentUser.organization_id)
        .single();

      if (existing) {
        await supabase
          .from("stripe_connections")
          .update({ is_connected: true, connected_at: new Date().toISOString() })
          .eq("organization_id", currentUser.organization_id);
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

      // Upsert the stripe_connections row
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("stripe_connections")
        .select("id")
        .eq("organization_id", organizationId)
        .single();

      if (existing) {
        await supabase
          .from("stripe_connections")
          .update({ stripe_account_id: data.accountId, is_connected: false })
          .eq("organization_id", organizationId);
      } else {
        await supabase.from("stripe_connections").insert({
          organization_id: organizationId,
          stripe_account_id: data.accountId,
          is_connected: false,
        });
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
      const supabase = createClient();
      await supabase
        .from("stripe_connections")
        .update({ is_connected: false })
        .eq("organization_id", organizationId);
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
    if (!userEmail) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_connect_account", email: userEmail }),
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
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#6b7280]" />
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
                    ? `Your Stripe account is connected and ready to go! (${stripeAccountId})`
                    : "Connect your Stripe account to start accepting payments."}
                </p>
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
                  disabled={actionLoading}
                >
                  {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Update Stripe Account
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Disconnect Stripe Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Stripe Account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will disconnect your Stripe account. You will not be able to process payments until you reconnect. This action can be reversed by reconnecting.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={handleDisconnect}
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <Button
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                onClick={handleConnect}
                disabled={actionLoading}
              >
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Connect Stripe Account
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
