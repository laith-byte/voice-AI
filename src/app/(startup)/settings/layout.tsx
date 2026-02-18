"use client";

import { TabNav } from "@/components/layout/tab-nav";

const settingsTabs = [
  { label: "Startup", href: "/settings/startup" },
  { label: "Whitelabel", href: "/settings/whitelabel" },
  { label: "Members", href: "/settings/members" },
  { label: "Integrations", href: "/settings/integrations" },
  { label: "Phone / SIP", href: "/settings/phone-sip" },
  { label: "Webhook Logs", href: "/settings/webhook-logs" },
  { label: "Usage", href: "/settings/usage" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#111827]">Settings</h1>
        <p className="text-sm text-[#6b7280] mt-1">
          Manage your startup configuration, branding, members, and integrations.
        </p>
      </div>
      <TabNav tabs={settingsTabs} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
