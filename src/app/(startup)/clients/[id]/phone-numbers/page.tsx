"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Search, Plus, Phone, Unlink, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { PhoneNumber } from "@/types/database";

interface PhoneNumberWithAgent extends PhoneNumber {
  agent_name: string | null;
}

interface AvailableAgent {
  id: string;
  name: string;
}

export default function PhoneNumbersPage() {
  const params = useParams();
  const [search, setSearch] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberWithAgent[]>([]);
  const [availableAgents, setAvailableAgents] = useState<AvailableAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const clientId = params.id as string;

  const fetchPhoneNumbers = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("phone_numbers")
      .select("*, agents(name)")
      .eq("client_id", clientId);

    if (error) {
      console.error("Error fetching phone numbers:", error);
      toast.error("Failed to load phone numbers");
      return;
    }

    const mapped: PhoneNumberWithAgent[] = (data ?? []).map((pn: any) => ({
      id: pn.id,
      organization_id: pn.organization_id,
      client_id: pn.client_id,
      agent_id: pn.agent_id,
      number: pn.number,
      retell_number_id: pn.retell_number_id,
      type: pn.type,
      created_at: pn.created_at,
      agent_name: pn.agents?.name ?? null,
    }));

    setPhoneNumbers(mapped);
  }, [clientId]);

  const fetchAvailableAgents = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("agents")
      .select("id, name")
      .eq("client_id", clientId);

    if (error) {
      console.error("Error fetching agents:", error);
      toast.error("Failed to load agents");
      return;
    }

    setAvailableAgents(data ?? []);
  }, [clientId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchPhoneNumbers(), fetchAvailableAgents()]);
    setLoading(false);
  }, [fetchPhoneNumbers, fetchAvailableAgents]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredNumbers = phoneNumbers.filter((pn) =>
    pn.number.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssignToAgent = async () => {
    if (!selectedNumber || !selectedAgentId) return;
    setMutating(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("phone_numbers")
      .update({ agent_id: selectedAgentId })
      .eq("id", selectedNumber);

    if (error) {
      console.error("Error assigning agent:", error);
      toast.error("Failed to assign phone number to agent");
    } else {
      toast.success("Phone number assigned to agent.");
      await fetchPhoneNumbers();
    }

    setMutating(false);
    setAssignDialogOpen(false);
    setSelectedNumber(null);
    setSelectedAgentId("");
  };

  const handleUnassignFromAgent = async (numberId: string) => {
    setMutating(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("phone_numbers")
      .update({ agent_id: null })
      .eq("id", numberId);

    if (error) {
      console.error("Error unassigning agent:", error);
      toast.error("Failed to unassign phone number from agent");
    } else {
      toast.success("Phone number unassigned.");
      await fetchPhoneNumbers();
    }

    setMutating(false);
  };

  const openAssignDialog = (numberId: string) => {
    setSelectedNumber(numberId);
    setAssignDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Phone Numbers</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search & Filter */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
              <Input
                placeholder="Search phone numbers..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Phone Numbers Table */}
          {filteredNumbers.length > 0 ? (
            <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Phone Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Assigned Agent</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNumbers.map((pn) => (
                    <TableRow key={pn.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-[#6b7280]" />
                          <span className="font-medium text-[#111827]">
                            {pn.number}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            pn.type === "inbound"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }
                        >
                          {pn.type.charAt(0).toUpperCase() + pn.type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-purple-50 text-purple-700 border-purple-200"
                        >
                          Voice AI
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[#6b7280]">
                        {pn.agent_name || (
                          <span className="text-[#6b7280] italic">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-[#6b7280]">
                        {new Date(pn.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        {pn.agent_id ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={() => handleUnassignFromAgent(pn.id)}
                            disabled={mutating}
                          >
                            <Unlink className="w-3.5 h-3.5 mr-1.5" />
                            Unassign
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAssignDialog(pn.id)}
                            disabled={mutating}
                          >
                            Assign to Agent
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center border border-[#e5e7eb] rounded-lg">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Phone className="w-6 h-6 text-[#6b7280]" />
              </div>
              <h3 className="text-base font-medium text-[#111827] mb-1">
                No phone numbers found
              </h3>
              <p className="text-sm text-[#6b7280] max-w-sm">
                {search
                  ? "No phone numbers match your search. Try a different query."
                  : "No phone numbers have been assigned to this client yet. Add phone numbers from the organization settings."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign to Agent Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Agent</DialogTitle>
            <DialogDescription>
              Select an agent to assign this phone number to.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="assign-agent">Agent</Label>
              <Select
                value={selectedAgentId}
                onValueChange={setSelectedAgentId}
              >
                <SelectTrigger id="assign-agent">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {availableAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
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
              onClick={handleAssignToAgent}
              disabled={!selectedAgentId || mutating}
            >
              {mutating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
