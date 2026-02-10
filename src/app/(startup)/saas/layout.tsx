"use client";

import { TabNav } from "@/components/layout/tab-nav";

const saasTabs = [
  { label: "Connect Stripe", href: "/saas/connect" },
  { label: "Agent Templates", href: "/saas/templates" },
  { label: "Client Plans", href: "/saas/plans" },
  { label: "Pricing Tables", href: "/saas/pricing-tables" },
  { label: "Advanced Settings", href: "/saas/advanced" },
];

export default function SaaSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#111827]">SaaS Configurator</h1>
        <p className="text-sm text-[#6b7280] mt-1">
          Configure your SaaS platform, templates, plans, and pricing.
        </p>
      </div>
      <TabNav tabs={saasTabs} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
