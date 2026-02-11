"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Copy, Check, Pencil, Code, Play } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TabNav } from "@/components/layout/tab-nav";
import { createClient } from "@/lib/supabase/client";
import type { Agent } from "@/types/database";
import { PrototypeCallDialog } from "@/components/agents/prototype-call-dialog";

export default function AgentDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const id = params.id as string;

  const [agent, setAgent] = useState<(Omit<Agent, "retell_api_key_encrypted"> & { clients?: { name: string } | null }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [prototypeOpen, setPrototypeOpen] = useState(false);

  const fetchAgent = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("agents")
      .select("id, name, description, platform, retell_agent_id, knowledge_base_id, knowledge_base_name, webhook_url, organization_id, client_id, created_at, updated_at, clients(name)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Failed to fetch agent:", error);
      setLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAgent(data as any);
    setEditedName(data.name);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  const tabs = [
    { label: "Overview", href: `/agents/${id}/overview` },
    { label: "Agent Config", href: `/agents/${id}/agent-config` },
    { label: "Widget", href: `/agents/${id}/widget` },
    { label: "AI Analysis", href: `/agents/${id}/ai-analysis` },
    { label: "Campaigns", href: `/agents/${id}/campaigns` },
  ];

  function handleCopyId() {
    if (!agent) return;
    navigator.clipboard.writeText(agent.retell_agent_id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  async function handleSaveName() {
    setIsEditingName(false);
    if (!agent || editedName === agent.name) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("agents")
      .update({ name: editedName })
      .eq("id", agent.id);

    if (error) {
      console.error("Failed to update agent name:", error);
      setEditedName(agent.name);
      return;
    }

    setAgent((prev) => (prev ? { ...prev, name: editedName } : prev));
  }

  function handleNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSaveName();
    }
    if (e.key === "Escape") {
      setEditedName(agent?.name ?? "");
      setIsEditingName(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6b7280]" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <p className="text-[#6b7280]">Agent not found.</p>
      </div>
    );
  }

  const clientName = agent.clients?.name;
  const platformLabel = agent.platform.charAt(0).toUpperCase() + agent.platform.slice(1);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-2">
          {/* Agent Name - Editable inline */}
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={handleNameKeyDown}
                autoFocus
                className="text-2xl font-semibold h-auto py-1 px-2 w-72"
              />
            ) : (
              <h1
                className="text-2xl font-semibold text-[#111827] cursor-pointer group flex items-center gap-2"
                onClick={() => setIsEditingName(true)}
              >
                {editedName}
                <Pencil className="h-4 w-4 text-[#6b7280] opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}
          </div>

          {/* Agent ID + badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#6b7280] font-mono">
                {agent.retell_agent_id}
              </span>
              <button
                onClick={handleCopyId}
                className="text-[#6b7280] hover:text-[#111827] transition-colors"
                title="Copy Agent ID"
              >
                {copiedId ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            <Badge
              variant="secondary"
              className="bg-blue-50 text-[#2563eb] border border-blue-200"
            >
              {platformLabel}
            </Badge>

            {agent.client_id ? (
              <Badge
                variant="outline"
                className="text-[#6b7280] border-[#e5e7eb]"
              >
                Assigned To: {clientName ?? "Unknown"}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[#6b7280] border-[#e5e7eb]"
              >
                Unassigned
              </Badge>
            )}
          </div>
        </div>

        {/* Top-right buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setPrototypeOpen(true)}>
            <Play className="h-4 w-4" />
            Prototype
          </Button>
          <Button variant="outline" className="gap-2">
            <Code className="h-4 w-4" />
            Embed Code
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <TabNav tabs={tabs} />

      {/* Tab content */}
      <div className="mt-6">{children}</div>

      <PrototypeCallDialog
        agentId={agent.id}
        agentName={agent.name}
        open={prototypeOpen}
        onOpenChange={setPrototypeOpen}
      />
    </div>
  );
}
