"use client";

import { useParams } from "next/navigation";
import { PromptTreeEditor } from "@/components/agents/prompt-tree-editor";
import { FeatureGate } from "@/components/portal/feature-gate";

export default function PromptTreePage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <FeatureGate feature="conversation_flows">
      <PromptTreeEditor agentId={id} />
    </FeatureGate>
  );
}
