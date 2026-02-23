"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Phone, Unlink, Loader2, Trash2, Download } from "lucide-react";
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

interface TwilioAvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
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
  const [deletingPhone, setDeletingPhone] = useState<string | null>(null);

  // Purchase dialog state
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [searchAreaCode, setSearchAreaCode] = useState("");
  const [searchTollFree, setSearchTollFree] = useState(false);
  const [searchResults, setSearchResults] = useState<TwilioAvailableNumber[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTwilioNumber, setSelectedTwilioNumber] = useState<string | null>(null);
  const [purchaseAgentId, setPurchaseAgentId] = useState("");

  // Import dialog state
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPhoneNumber, setImportPhoneNumber] = useState("");
  const [importAgentId, setImportAgentId] = useState("");

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: PhoneNumberWithAgent[] = (data ?? []).map((pn: any) => ({
      id: pn.id,
      organization_id: pn.organization_id,
      client_id: pn.client_id,
      agent_id: pn.agent_id,
      number: pn.number,
      retell_number_id: pn.retell_number_id,
      twilio_sid: pn.twilio_sid ?? null,
      type: pn.type,
      caller_id_name: pn.caller_id_name ?? null,
      caller_id_verified: pn.caller_id_verified ?? false,
      cnam_status: pn.cnam_status ?? null,
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

    try {
      const res = await fetch(`/api/phone-numbers/${selectedNumber}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgentId }),
      });
      if (!res.ok) throw new Error("Failed to assign agent");
      toast.success("Phone number assigned to agent.");
      await fetchPhoneNumbers();
    } catch {
      toast.error("Failed to assign phone number to agent");
    }

    setMutating(false);
    setAssignDialogOpen(false);
    setSelectedNumber(null);
    setSelectedAgentId("");
  };

  const handleUnassignFromAgent = async (numberId: string) => {
    setMutating(true);

    try {
      const res = await fetch(`/api/phone-numbers/${numberId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: null }),
      });
      if (!res.ok) throw new Error("Failed to unassign agent");
      toast.success("Phone number unassigned.");
      await fetchPhoneNumbers();
    } catch {
      toast.error("Failed to unassign phone number from agent");
    }

    setMutating(false);
  };

  const handleDeletePhone = async (id: string) => {
    setDeletingPhone(id);
    try {
      const res = await fetch(`/api/phone-numbers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete phone number");
      toast.success("Phone number deleted");
      fetchPhoneNumbers();
    } catch {
      toast.error("Failed to delete phone number");
    } finally {
      setDeletingPhone(null);
    }
  };

  // Search Twilio available numbers
  const handleSearchNumbers = async () => {
    if (!searchTollFree && searchAreaCode.length !== 3) {
      toast.error("Please enter a 3-digit area code");
      return;
    }
    setSearching(true);
    setSearchResults([]);
    setSelectedTwilioNumber(null);
    try {
      const params = new URLSearchParams();
      if (!searchTollFree && searchAreaCode) params.set("areaCode", searchAreaCode);
      if (searchTollFree) params.set("tollFree", "true");
      const res = await fetch(`/api/phone-numbers/search?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Search failed");
      }
      const data = await res.json();
      setSearchResults(data);
      if (data.length === 0) toast.info("No numbers found. Try a different area code.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  // Purchase number (client pre-filled)
  const handlePurchase = async () => {
    if (!selectedTwilioNumber) {
      toast.error("Please select a number");
      return;
    }
    setPurchasing(true);
    try {
      const res = await fetch("/api/phone-numbers/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: selectedTwilioNumber,
          clientId,
          agentId: purchaseAgentId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Purchase failed");
      }
      const data = await res.json();
      toast.success("Phone number purchased successfully");
      if (data.warnings?.length) {
        data.warnings.forEach((w: string) => toast.warning(w));
      }
      setPurchaseOpen(false);
      setSearchResults([]);
      setSelectedTwilioNumber(null);
      setSearchAreaCode("");
      setPurchaseAgentId("");
      fetchPhoneNumbers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  };

  // Import number (client pre-filled)
  const handleImport = async () => {
    if (!importPhoneNumber.trim()) {
      toast.error("Please enter a phone number");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/phone-numbers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: importPhoneNumber.trim(),
          clientId,
          agentId: importAgentId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Import failed");
      }
      const data = await res.json();
      toast.success("Phone number imported successfully");
      if (data.warnings?.length) {
        data.warnings.forEach((w: string) => toast.warning(w));
      }
      setImportOpen(false);
      setImportPhoneNumber("");
      setImportAgentId("");
      fetchPhoneNumbers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const openAssignDialog = (numberId: string) => {
    setSelectedNumber(numberId);
    setAssignDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Phone Numbers</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Import Number
              </Button>
              <Button size="sm" onClick={() => setPurchaseOpen(true)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Purchase Number
              </Button>
            </div>
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
                        <div className="flex items-center justify-end gap-1">
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
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                disabled={deletingPhone === pn.id}
                              >
                                {deletingPhone === pn.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Phone Number?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will release the number from Twilio, remove it from Retell, and delete it from the database. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeletePhone(pn.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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
                  : "No phone numbers have been assigned to this client yet. Use the buttons above to purchase or import a number."}
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

      {/* Purchase Number Dialog */}
      <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Purchase Phone Number</DialogTitle>
            <DialogDescription>
              Search for and purchase a phone number from Twilio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <Label>Area Code</Label>
                <Input
                  placeholder="e.g. 512"
                  value={searchAreaCode}
                  onChange={(e) => setSearchAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  maxLength={3}
                  disabled={searchTollFree}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={searchTollFree}
                  onCheckedChange={setSearchTollFree}
                />
                <Label className="text-sm">Toll-Free</Label>
              </div>
              <div className="pt-6">
                <Button onClick={handleSearchNumbers} disabled={searching} className="gap-2">
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </Button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {searchResults.map((n) => (
                  <button
                    key={n.phoneNumber}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition-colors ${
                      selectedTwilioNumber === n.phoneNumber
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedTwilioNumber(n.phoneNumber)}
                  >
                    <span className="font-mono">{n.phoneNumber}</span>
                    {n.locality && (
                      <span className="text-[#6b7280] ml-2 text-xs">
                        {n.locality}, {n.region}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Agent (optional)</Label>
              <Select value={purchaseAgentId} onValueChange={setPurchaseAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {availableAgents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={purchasing || !selectedTwilioNumber}
              className="gap-2"
            >
              {purchasing && <Loader2 className="w-4 h-4 animate-spin" />}
              Purchase Number
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Number Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Phone Number</DialogTitle>
            <DialogDescription>
              Import an existing phone number to Retell and register with Hiya.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Phone Number (E.164)</Label>
              <Input
                placeholder="+15551234567"
                value={importPhoneNumber}
                onChange={(e) => setImportPhoneNumber(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Agent (optional)</Label>
              <Select value={importAgentId} onValueChange={setImportAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {availableAgents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importing} className="gap-2">
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              Import Number
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
