"use client";

import { TabNav } from "@/components/layout/tab-nav";

const billingTabs = [
  { label: "Connect", href: "/billing/connect" },
  { label: "Active Products", href: "/billing/products" },
  { label: "Subscriptions", href: "/billing/subscriptions" },
  { label: "Transactions", href: "/billing/transactions" },
  { label: "Invoices", href: "/billing/invoices" },
  { label: "Coupons", href: "/billing/coupons" },
];

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#111827]">Stripe Billing</h1>
        <p className="text-sm text-[#6b7280] mt-1">
          Manage your Stripe account, products, subscriptions, and invoices.
        </p>
      </div>
      <TabNav tabs={billingTabs} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
