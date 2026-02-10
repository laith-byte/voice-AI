"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface AgentRow {
  id: string;
  name: string;
  platform: string;
  client_id: string | null;
  created_at: string;
  clients: { name: string } | null;
}

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    platform: "retell",
    retell_agent_id: "",
    retell_api_key_encrypted: "",
  });

  const fetchAgents = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("agents")
      .select("id, name, platform, client_id, created_at, clients(name)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load agents");
    } else if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAgents(data as any);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateAgent = async () => {
    setCreating(true);
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAgent),
    });

    if (res.ok) {
      setDialogOpen(false);
      setNewAgent({ name: "", platform: "retell", retell_agent_id: "", retell_api_key_encrypted: "" });
      fetchAgents();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "Failed to create agent");
    }
    setCreating(false);
  };

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#111827]">Agents</h1>
          <p className="text-sm text-[#6b7280] mt-1">
            Manage your voice agents, configure settings, and assign them to
            clients.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Agent</DialogTitle>
              <DialogDescription>
                Create a new voice agent. You&apos;ll need the Retell Agent ID to connect it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent Name</Label>
                <Input
                  id="agent-name"
                  placeholder="e.g. Sales Assistant"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-platform">Platform</Label>
                <Select
                  value={newAgent.platform}
                  onValueChange={(value) => setNewAgent({ ...newAgent, platform: value })}
                >
                  <SelectTrigger id="agent-platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retell">Retell</SelectItem>
                    <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                    <SelectItem value="vapi">Vapi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="retell-agent-id">Retell Agent ID</Label>
                <Input
                  id="retell-agent-id"
                  placeholder="agent_xxxxxxxxxxxx"
                  value={newAgent.retell_agent_id}
                  onChange={(e) => setNewAgent({ ...newAgent, retell_agent_id: e.target.value })}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retell-api-key">Retell API Key</Label>
                <Input
                  id="retell-api-key"
                  type="password"
                  placeholder="key_xxxxxxxxxxxx"
                  value={newAgent.retell_api_key_encrypted}
                  onChange={(e) => setNewAgent({ ...newAgent, retell_api_key_encrypted: e.target.value })}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                onClick={handleCreateAgent}
                disabled={!newAgent.name.trim() || !newAgent.retell_agent_id.trim() || creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Add Agent"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b7280]" />
        <Input
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 max-w-sm"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="border border-[#e5e7eb] rounded-lg py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
        </div>
      ) : filteredAgents.length > 0 ? (
        <div className="border border-[#e5e7eb] rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-gray-50">
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Platform
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Assigned Client
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {filteredAgents.map((agent) => (
                <tr
                  key={agent.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/agents/${agent.id}/overview`}
                      className="text-sm font-medium text-[#111827] hover:text-[#2563eb]"
                    >
                      {agent.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className="bg-blue-50 text-[#2563eb] border border-blue-200"
                    >
                      {agent.platform.charAt(0).toUpperCase() + agent.platform.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {agent.clients ? (
                      <Link
                        href={`/clients/${agent.client_id}/overview`}
                        className="text-sm text-[#2563eb] hover:underline"
                      >
                        {agent.clients.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-[#6b7280]">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#6b7280]">
                      {formatDate(agent.created_at)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-[#e5e7eb] border-dashed rounded-lg py-16 flex flex-col items-center justify-center">
          <div className="bg-gray-100 rounded-full p-3 mb-4">
            <Search className="h-6 w-6 text-[#6b7280]" />
          </div>
          <h3 className="text-sm font-medium text-[#111827] mb-1">
            No agents found
          </h3>
          <p className="text-sm text-[#6b7280] mb-4">
            {search
              ? "Try adjusting your search query."
              : "Get started by creating your first agent."}
          </p>
          {!search && (
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Agent
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
