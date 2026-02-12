"use client";

import { useParams } from "next/navigation";
import { BusinessInfoForm } from "@/components/business-settings/business-info-form";
import { HoursEditor } from "@/components/business-settings/hours-editor";
import { ServicesList } from "@/components/business-settings/services-list";
import { FaqsList } from "@/components/business-settings/faqs-list";
import { PoliciesList } from "@/components/business-settings/policies-list";
import { LocationsList } from "@/components/business-settings/locations-list";
import { CallHandlingSettings } from "@/components/business-settings/call-handling-settings";
import { PostCallActions } from "@/components/business-settings/post-call-actions";

export default function AdminBusinessSettingsPage() {
  const params = useParams();
  const clientId = params.id as string;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#111827]">Business Settings</h2>
        <p className="text-sm text-[#6b7280] mt-1">
          Manage this client&apos;s business information. Changes automatically regenerate the AI agent&apos;s system prompt.
        </p>
      </div>

      <BusinessInfoForm clientId={clientId} />
      <HoursEditor clientId={clientId} />
      <ServicesList clientId={clientId} />
      <FaqsList clientId={clientId} />
      <PoliciesList clientId={clientId} />
      <LocationsList clientId={clientId} />
      <CallHandlingSettings clientId={clientId} />

      <div className="border-t pt-2" />

      <PostCallActions clientId={clientId} />
    </div>
  );
}
