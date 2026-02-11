"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amount: string;
  status: "paid" | "open" | "draft" | "void" | "uncollectible";
  dueDate: string;
  createdAt: string;
  hostedInvoiceUrl: string | null;
}

export default function BillingInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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
          action: "list_invoices",
          stripeAccountId: connection.stripe_account_id,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: Invoice[] = (data as any[]).map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.number || inv.id,
        clientName:
          inv.customer_name ||
          inv.customer_email ||
          inv.customer ||
          "Unknown",
        amount:
          inv.status === "paid"
            ? `$${((inv.amount_paid ?? 0) / 100).toFixed(2)}`
            : `$${((inv.amount_due ?? 0) / 100).toFixed(2)}`,
        status: inv.status as Invoice["status"],
        dueDate: inv.due_date
          ? new Date(inv.due_date * 1000).toLocaleDateString()
          : "N/A",
        createdAt: inv.created
          ? new Date(inv.created * 1000).toLocaleDateString()
          : "N/A",
        hostedInvoiceUrl: inv.hosted_invoice_url || null,
      }));
      setInvoices(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load invoices");
      setInvoices([]);
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
          <FileText className="h-6 w-6 text-[#6b7280]" />
        </div>
        <h3 className="text-sm font-medium text-[#111827] mb-1">
          Stripe not connected
        </h3>
        <p className="text-sm text-[#6b7280] mb-4">
          Connect your Stripe account to view invoices.
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
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
        </h2>
        <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white" onClick={() => toast.info("Invoice creation coming soon. Create invoices directly in your Stripe dashboard for now.")}>
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      {/* Invoices Table */}
      {invoices.length > 0 ? (
        <div className="border border-[#e5e7eb] rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-gray-50">
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Invoice
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Client
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Amount
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Due Date
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-[#2563eb]">
                    {invoice.hostedInvoiceUrl ? (
                      <a
                        href={invoice.hostedInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </a>
                    ) : (
                      invoice.invoiceNumber
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#111827]">
                    {invoice.clientName}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#111827]">
                    {invoice.amount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                        invoice.status === "paid"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : invoice.status === "open"
                          ? "bg-blue-50 text-[#2563eb] border border-blue-200"
                          : invoice.status === "draft"
                          ? "bg-gray-100 text-[#6b7280] border border-[#e5e7eb]"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6b7280]">
                    {invoice.dueDate}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6b7280]">
                    {invoice.createdAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-[#e5e7eb] border-dashed rounded-lg py-16 flex flex-col items-center justify-center">
          <div className="bg-gray-100 rounded-full p-3 mb-4">
            <FileText className="h-6 w-6 text-[#6b7280]" />
          </div>
          <h3 className="text-sm font-medium text-[#111827] mb-1">
            No invoices found
          </h3>
          <p className="text-sm text-[#6b7280] mb-4">
            Create an invoice to bill your clients.
          </p>
          <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      )}
    </div>
  );
}
