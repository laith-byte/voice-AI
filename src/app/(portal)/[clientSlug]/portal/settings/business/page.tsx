"use client";

import { useState, useEffect, useCallback } from "react";
import { BusinessInfoForm } from "@/components/business-settings/business-info-form";
import { HoursEditor } from "@/components/business-settings/hours-editor";
import { ServicesList } from "@/components/business-settings/services-list";
import { FaqsList } from "@/components/business-settings/faqs-list";
import { PoliciesList } from "@/components/business-settings/policies-list";
import { LocationsList } from "@/components/business-settings/locations-list";
import { CallHandlingSettings } from "@/components/business-settings/call-handling-settings";
import { PostCallActions } from "@/components/business-settings/post-call-actions";
import { PiiRedactionSettings } from "@/components/business-settings/pii-redaction-settings";

export default function PortalBusinessSettingsPage() {
  const [sharedSettings, setSharedSettings] = useState<Record<string, unknown> | null>(null);

  const fetchSharedSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/business-settings");
      if (res.ok) {
        const data = await res.json();
        setSharedSettings(data.settings ?? data);
      }
    } catch {
      // Sub-components will fetch independently as fallback
    }
  }, []);

  useEffect(() => {
    fetchSharedSettings();
  }, [fetchSharedSettings]);

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Business Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your business information, hours, services, and more. Changes are automatically applied to your AI agent.
          </p>
        </div>

        <BusinessInfoForm initialSettings={sharedSettings} />
        <HoursEditor />
        <ServicesList />
        <FaqsList />
        <PoliciesList />
        <LocationsList />
        <CallHandlingSettings initialSettings={sharedSettings} />

        {/* Section divider */}
        <div className="border-t pt-2" />

        <PostCallActions />

        {/* Section divider */}
        <div className="border-t pt-2" />

        <PiiRedactionSettings />
      </div>
    </div>
  );
}
