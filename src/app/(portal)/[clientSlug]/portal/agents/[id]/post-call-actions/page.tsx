"use client";

import { useParams } from "next/navigation";
import { FeatureGate } from "@/components/portal/feature-gate";
import { PostCallActions } from "@/components/knowledge-base/post-call-actions";

export default function PostCallActionsPage() {
  const params = useParams();
  const agentId = params.id as string;

  return (
    <FeatureGate feature="agent_settings">
      <div className="p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-primary/40 mb-3" />
            <h1 className="text-3xl font-bold tracking-tight">Post-Call Actions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure automated actions that run after each call ends.
            </p>
          </div>
          <PostCallActions agentId={agentId} />
        </div>
      </div>
    </FeatureGate>
  );
}
