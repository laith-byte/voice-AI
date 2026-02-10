"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Ticket, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

interface Coupon {
  id: string;
  code: string;
  discount: string;
  type: "percent" | "fixed";
  redemptions: number;
  maxRedemptions: number | null;
  expiresAt: string | null;
  active: boolean;
}

export default function BillingCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState<"percent" | "fixed">("percent");
  const [newAmount, setNewAmount] = useState("");
  const [newDuration, setNewDuration] = useState<"once" | "repeating" | "forever">("once");

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
      setStripeAccountId(connection.stripe_account_id);

      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_coupons",
          stripeAccountId: connection.stripe_account_id,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: Coupon[] = (data as any[]).map((c: any) => ({
        id: c.id,
        code: c.id,
        discount: c.percent_off
          ? `${c.percent_off}`
          : c.amount_off
          ? `$${(c.amount_off / 100).toFixed(2)}`
          : "0",
        type: c.percent_off ? "percent" : "fixed",
        redemptions: c.times_redeemed || 0,
        maxRedemptions: c.max_redemptions || null,
        expiresAt: c.redeem_by
          ? new Date(c.redeem_by * 1000).toLocaleDateString()
          : null,
        active: c.valid,
      }));
      setCoupons(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load coupons");
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateCoupon = async () => {
    if (!stripeAccountId || !newCode || !newAmount) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        action: "create_coupon",
        stripeAccountId,
        code: newCode,
        duration: newDuration,
      };

      if (newType === "percent") {
        body.percent_off = parseFloat(newAmount);
      } else {
        body.amount_off = parseFloat(newAmount);
      }

      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Refresh list
      await fetchData();
      setDialogOpen(false);
      setNewCode("");
      setNewType("percent");
      setNewAmount("");
      setNewDuration("once");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create coupon");
    } finally {
      setCreating(false);
    }
  };

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
          <Ticket className="h-6 w-6 text-[#6b7280]" />
        </div>
        <h3 className="text-sm font-medium text-[#111827] mb-1">
          Stripe not connected
        </h3>
        <p className="text-sm text-[#6b7280] mb-4">
          Connect your Stripe account to manage coupons.
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-[#111827]">
          {coupons.length} coupon{coupons.length !== 1 ? "s" : ""}
        </h2>
        <Button
          className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Coupon
        </Button>
      </div>

      {/* Coupons Table */}
      {coupons.length > 0 ? (
        <div className="border border-[#e5e7eb] rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-gray-50">
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Code
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Discount
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Redemptions
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Expires
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {coupons.map((coupon) => (
                <tr
                  key={coupon.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded text-[#111827]">
                      {coupon.code}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#111827]">
                    {coupon.discount}
                    {coupon.type === "percent" ? "%" : ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6b7280]">
                    {coupon.redemptions}
                    {coupon.maxRedemptions
                      ? ` / ${coupon.maxRedemptions}`
                      : " / Unlimited"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6b7280]">
                    {coupon.expiresAt ?? "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                        coupon.active
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-gray-100 text-[#6b7280] border border-[#e5e7eb]"
                      }`}
                    >
                      {coupon.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-[#e5e7eb] border-dashed rounded-lg py-16 flex flex-col items-center justify-center">
          <div className="bg-gray-100 rounded-full p-3 mb-4">
            <Ticket className="h-6 w-6 text-[#6b7280]" />
          </div>
          <h3 className="text-sm font-medium text-[#111827] mb-1">
            No coupons found
          </h3>
          <p className="text-sm text-[#6b7280] mb-4">
            Create discount coupons for your clients.
          </p>
          <Button
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Coupon
          </Button>
        </div>
      )}

      {/* Create Coupon Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Coupon</DialogTitle>
            <DialogDescription>
              Add a new discount coupon to your Stripe account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coupon-code">Code</Label>
              <Input
                id="coupon-code"
                placeholder="SUMMER20"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={newType}
                onValueChange={(val) => setNewType(val as "percent" | "fixed")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-amount">
                {newType === "percent" ? "Percent Off" : "Amount Off (USD)"}
              </Label>
              <Input
                id="coupon-amount"
                type="number"
                step={newType === "percent" ? "1" : "0.01"}
                min="0"
                max={newType === "percent" ? "100" : undefined}
                placeholder={newType === "percent" ? "20" : "10.00"}
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select
                value={newDuration}
                onValueChange={(val) =>
                  setNewDuration(val as "once" | "repeating" | "forever")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Once</SelectItem>
                  <SelectItem value="repeating">Repeating</SelectItem>
                  <SelectItem value="forever">Forever</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              onClick={handleCreateCoupon}
              disabled={creating || !newCode || !newAmount}
            >
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
