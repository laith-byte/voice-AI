"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Label } from "@/components/ui/label";
import { Plus, Bot, Unlink, Loader2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Agent } from "@/types/database";

function PlatformBadge({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    retell: "bg-purple-50 text-purple-700 border-purple-200",
    "retell-chat": "bg-blue-50 text-blue-700 border-blue-200",
    "retell-sms": "bg-green-50 text-green-700 border-green-200",
    elevenlabs: "bg-orange-50 text-orange-700 border-orange-200",
    vapi: "bg-teal-50 text-teal-700 border-teal-200",
  };

  const labels: Record<string, string> = {
    retell: "Voice AI",
    "retell-chat": "Chat AI",
    "retell-sms": "SMS AI",
  };

  return (
    <Badge
      variant="outline"
      className={colors[platform] || "bg-gray-50 text-gray-700 border-gray-200"}
    >
      {labels[platform] || platform.charAt(0).toUpperCase() + platform.slice(1)}
    </Badge>
  );
}

export default function AssignedAgentsPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [assignedAgents, setAssignedAgents] = useState<Agent[]>([]);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("");

  const fetchAgents = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);

    // Fetch assigned agents (agents with client_id matching this client)
    const { data: assigned, error: assignedError } = await supabase
      .from("agents")
      .select("*")
      .eq("client_id", clientId);

    if (assignedError) {
      console.error("Error fetching assigned agents:", assignedError);
      setLoading(false);
      return;
    }

    setAssignedAgents(assigned || []);

    // Determine the organization_id from the assigned agents, or fetch from the client record
    let orgId: string | null = null;

    if (assigned && assigned.length > 0) {
      orgId = assigned[0].organization_id;
    } else {
      // Fetch org_id from the client record
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("organization_id")
        .eq("id", clientId)
        .single();

      if (clientError) {
        console.error("Error fetching client:", clientError);
        setLoading(false);
        return;
      }

      orgId = clientData?.organization_id || null;
    }

    if (orgId) {
      // Fetch available agents (same org, no client assigned)
      const { data: available, error: availableError } = await supabase
        .from("agents")
        .select("*")
        .eq("organization_id", orgId)
        .is("client_id", null);

      if (availableError) {
        console.error("Error fetching available agents:", availableError);
      } else {
        setAvailableAgents(available || []);
      }
    }

    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleAssign = async () => {
    if (!selectedAgentId) return;

    const supabase = createClient();
    setAssigning(true);

    const { error } = await supabase
      .from("agents")
      .update({ client_id: clientId })
      .eq("id", selectedAgentId);

    if (error) {
      console.error("Error assigning agent:", error);
      toast.error("Failed to assign agent. Please try again.");
    } else {
      setAssignDialogOpen(false);
      setSelectedAgentId("");
      toast.success("Agent assigned.");
      await fetchAgents();
    }

    setAssigning(false);
  };

  const handleUnassign = async (agentId: string) => {
    const supabase = createClient();
    setUnassigningId(agentId);

    const { error } = await supabase
      .from("agents")
      .update({ client_id: null })
      .eq("id", agentId);

    if (error) {
      console.error("Error unassigning agent:", error);
      toast.error("Failed to unassign agent. Please try again.");
    } else {
      toast.success("Agent unassigned.");
      await fetchAgents();
    }

    setUnassigningId(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="rounded-lg">
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
            <span className="ml-2 text-sm text-[#6b7280]">
              Loading agents...
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Assigned Agents</CardTitle>
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Assign Agent
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Agent</DialogTitle>
                  <DialogDescription>
                    Select an agent to assign to this client. Only unassigned
                    agents are shown.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="agent-select">Agent</Label>
                    <Select
                      value={selectedAgentId}
                      onValueChange={setSelectedAgentId}
                    >
                      <SelectTrigger id="agent-select">
                        <SelectValue placeholder="Select an agent" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAgents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            <span className="flex items-center gap-2">
                              {agent.name}
                              <span className="text-xs text-[#6b7280]">
                                ({agent.platform})
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAssignDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                    onClick={handleAssign}
                    disabled={!selectedAgentId || assigning}
                  >
                    {assigning && (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    )}
                    {assigning ? "Assigning..." : "Assign Agent"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {assignedAgents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Agent Name</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Assigned Date</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedAgents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="pl-6">
                      <Link
                        href={`/agents/${agent.id}/overview`}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="font-medium text-[#2563eb] hover:underline">
                          {agent.name}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <PlatformBadge platform={agent.platform} />
                    </TableCell>
                    <TableCell className="text-[#6b7280]">
                      {new Date(
                        agent.updated_at || agent.created_at
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => handleUnassign(agent.id)}
                        disabled={unassigningId === agent.id}
                      >
                        {unassigningId === agent.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Unlink className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {unassigningId === agent.id
                          ? "Unassigning..."
                          : "Unassign"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Bot className="w-6 h-6 text-[#6b7280]" />
              </div>
              <h3 className="text-base font-medium text-[#111827] mb-1">
                No agents assigned
              </h3>
              <p className="text-sm text-[#6b7280] max-w-sm">
                Assign agents to this client so they can access and manage them
                from their dashboard.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
