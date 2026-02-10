"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowUpDown, Receipt, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

interface Transaction {
  id: string;
  clientName: string;
  description: string;
  amount: string;
  status: "succeeded" | "pending" | "failed";
  date: string;
  receiptUrl: string | null;
}

export default function BillingTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

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
          action: "list_charges",
          stripeAccountId: connection.stripe_account_id,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: Transaction[] = (data as any[]).map((c: any) => ({
        id: c.id,
        clientName:
          c.billing_details?.name ||
          c.billing_details?.email ||
          c.customer ||
          "Unknown",
        description: c.description || c.statement_descriptor || "Charge",
        amount: `$${(c.amount / 100).toFixed(2)}`,
        status: c.status === "succeeded" ? "succeeded" : c.status === "pending" ? "pending" : "failed",
        date: c.created
          ? new Date(c.created * 1000).toLocaleDateString()
          : "N/A",
        receiptUrl: c.receipt_url || null,
      }));
      setTransactions(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load transactions");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          <Receipt className="h-6 w-6 text-[#6b7280]" />
        </div>
        <h3 className="text-sm font-medium text-[#111827] mb-1">
          Stripe not connected
        </h3>
        <p className="text-sm text-[#6b7280] mb-4">
          Connect your Stripe account to view transactions.
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
          {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
        </h2>
      </div>

      {/* Transactions Table */}
      {transactions.length > 0 ? (
        <div className="border border-[#e5e7eb] rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-gray-50">
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Client
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Description
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  <div className="flex items-center gap-1">
                    Amount
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {transactions.map((txn) => (
                <tr
                  key={txn.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-[#111827]">
                    {txn.clientName}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6b7280]">
                    {txn.receiptUrl ? (
                      <a
                        href={txn.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#2563eb] hover:underline"
                      >
                        {txn.description}
                      </a>
                    ) : (
                      txn.description
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#111827]">
                    {txn.amount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                        txn.status === "succeeded"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : txn.status === "pending"
                          ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6b7280]">
                    {txn.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-[#e5e7eb] border-dashed rounded-lg py-16 flex flex-col items-center justify-center">
          <div className="bg-gray-100 rounded-full p-3 mb-4">
            <Receipt className="h-6 w-6 text-[#6b7280]" />
          </div>
          <h3 className="text-sm font-medium text-[#111827] mb-1">
            No transactions found
          </h3>
          <p className="text-sm text-[#6b7280]">
            Transactions will appear here once your clients make payments.
          </p>
        </div>
      )}
    </div>
  );
}
