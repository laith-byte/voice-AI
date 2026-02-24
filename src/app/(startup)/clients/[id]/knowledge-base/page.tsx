"use client";

import { useParams } from "next/navigation";
import { BusinessInfoForm } from "@/components/knowledge-base/business-info-form";
import { HoursEditor } from "@/components/knowledge-base/hours-editor";
import { ServicesList } from "@/components/knowledge-base/services-list";
import { FaqsList } from "@/components/knowledge-base/faqs-list";
import { PoliciesList } from "@/components/knowledge-base/policies-list";
import { LocationsList } from "@/components/knowledge-base/locations-list";
import { CallHandlingSettings } from "@/components/knowledge-base/call-handling-settings";
import { PostCallActions } from "@/components/knowledge-base/post-call-actions";

export default function AdminKnowledgeBasePage() {
  const params = useParams();
  const clientId = params.id as string;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#111827]">Knowledge Base</h2>
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
