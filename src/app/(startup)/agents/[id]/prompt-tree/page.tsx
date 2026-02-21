"use client";

import { useParams } from "next/navigation";
import { PromptTreeEditor } from "@/components/agents/prompt-tree-editor";

export default function PromptTreePage() {
  const params = useParams();
  const id = params.id as string;

  return <PromptTreeEditor agentId={id} />;
}
