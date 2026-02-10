"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Info, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

interface Subscription {
  id: string;
  clientName: string;
  productName: string;
  status: "active" | "scheduled" | "canceled" | "past_due";
  amount: string;
  interval: string;
  currentPeriodEnd: string;
}

export default function BillingSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "scheduled">("active");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
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

      const { data: connection } = await supabase
        .from("stripe_connections")
        .select("stripe_account_id, is_connected")
        .eq("organization_id", currentUser.organization_id)
        .single();

      if (!connection?.is_connected) {
        setIsConnected(false);
        return;
      }
      setIsConnected(true);

      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_subscriptions",
          stripeAccountId: connection.stripe_account_id,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: Subscription[] = (data as any[]).map((s: any) => ({
        id: s.id,
        clientName:
          s.customer?.name || s.customer?.email || s.customer || "Unknown",
        productName:
          s.items?.data?.[0]?.price?.product?.name ||
          s.items?.data?.[0]?.plan?.nickname ||
          s.plan?.nickname ||
          "Unknown plan",
        status: s.status === "trialing" ? "active" : s.status,
        amount: s.items?.data?.[0]?.price?.unit_amount
          ? `$${(s.items.data[0].price.unit_amount / 100).toFixed(2)}`
          : s.plan?.amount
          ? `$${(s.plan.amount / 100).toFixed(2)}`
          : "$0.00",
        interval:
          s.items?.data?.[0]?.price?.recurring?.interval ||
          s.plan?.interval ||
          "month",
        currentPeriodEnd: s.current_period_end
          ? new Date(s.current_period_end * 1000).toLocaleDateString()
          : "N/A",
      }));
      setSubscriptions(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load subscriptions");
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (activeTab === "active") return sub.status === "active" || sub.status === "past_due";
    return sub.status === "scheduled";
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#6b7280]" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="border border-[#e5e7eb] border-dashed rounded-lg py-16 flex flex-col items-center justify-center">
        <div className="bg-gray-100 rounded-full p-3 mb-4">
          <RefreshCw className="h-6 w-6 text-[#6b7280]" />
        </div>
        <h3 className="text-sm font-medium text-[#111827] mb-1">
          Stripe not connected
        </h3>
        <p className="text-sm text-[#6b7280] mb-4">
          Connect your Stripe account to view subscriptions.
        </p>
        <Link href="/billing/connect">
          <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
            Go to Connect
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banners */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-[#2563eb] mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800">
          <p>
            Subscriptions are automatically managed through Stripe. Changes made
            here will be reflected in your Stripe Dashboard.
          </p>
        </div>
      </div>

      {/* Toggle & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === "active"
                ? "bg-white text-[#111827] shadow-sm"
                : "text-[#6b7280] hover:text-[#111827]"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setActiveTab("scheduled")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === "scheduled"
                ? "bg-white text-[#111827] shadow-sm"
                : "text-[#6b7280] hover:text-[#111827]"
            }`}
          >
            Scheduled
          </button>
        </div>
        <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
          <Plus className="h-4 w-4 mr-2" />
          Create Subscription
        </Button>
      </div>

      {/* Subscriptions Table */}
      {filteredSubscriptions.length > 0 ? (
        <div className="border border-[#e5e7eb] rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-gray-50">
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Client
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Product
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Amount
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Period End
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {filteredSubscriptions.map((sub) => (
                <tr
                  key={sub.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-[#111827]">
                    {sub.clientName}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6b7280]">
                    {sub.productName}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#111827]">
                    {sub.amount}/{sub.interval}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                        sub.status === "active"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : sub.status === "scheduled"
                          ? "bg-blue-50 text-[#2563eb] border border-blue-200"
                          : sub.status === "past_due"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-gray-100 text-[#6b7280] border border-[#e5e7eb]"
                      }`}
                    >
                      {sub.status === "past_due" ? "Past Due" : sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6b7280]">
                    {sub.currentPeriodEnd}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-[#e5e7eb] border-dashed rounded-lg py-16 flex flex-col items-center justify-center">
          <div className="bg-gray-100 rounded-full p-3 mb-4">
            <RefreshCw className="h-6 w-6 text-[#6b7280]" />
          </div>
          <h3 className="text-sm font-medium text-[#111827] mb-1">
            No {activeTab} subscriptions
          </h3>
          <p className="text-sm text-[#6b7280] mb-4">
            {activeTab === "active"
              ? "No active subscriptions found. Create one to get started."
              : "No scheduled subscriptions found."}
          </p>
          <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Create Subscription
          </Button>
        </div>
      )}
    </div>
  );
}
