"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Phone,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Save,
  X,
  Search,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";

interface PhoneNumber {
  id: string;
  number: string;
  type: string;
  agent_id: string | null;
  twilio_sid: string | null;
  caller_id_name: string | null;
  caller_id_verified: boolean;
  cnam_status: string;
  agents: { name: string } | null;
  clients: { name: string } | null;
}

interface SipTrunk {
  id: string;
  label: string;
  sip_uri: string;
  username: string | null;
  codec: string;
  status: string;
  created_at: string;
}

interface AgentOption {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface TwilioAvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
}

export default function PhoneSipSettingsPage() {
  // Phone numbers state
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [phonesLoading, setPhonesLoading] = useState(true);
  const [deletingPhone, setDeletingPhone] = useState<string | null>(null);

  // Purchase dialog state
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [searchAreaCode, setSearchAreaCode] = useState("");
  const [searchTollFree, setSearchTollFree] = useState(false);
  const [searchResults, setSearchResults] = useState<TwilioAvailableNumber[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTwilioNumber, setSelectedTwilioNumber] = useState<string | null>(null);
  const [purchaseClientId, setPurchaseClientId] = useState("");
  const [purchaseAgentId, setPurchaseAgentId] = useState("");

  // Import dialog state
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPhoneNumber, setImportPhoneNumber] = useState("");
  const [importClientId, setImportClientId] = useState("");
  const [importAgentId, setImportAgentId] = useState("");

  // Caller ID inline editing
  const [editingCallerId, setEditingCallerId] = useState<string | null>(null);
  const [callerIdInput, setCallerIdInput] = useState("");
  const [savingCallerId, setSavingCallerId] = useState(false);

  // SIP trunks state
  const [sipTrunks, setSipTrunks] = useState<SipTrunk[]>([]);
  const [sipLoading, setSipLoading] = useState(true);
  const [addSipOpen, setAddSipOpen] = useState(false);
  const [addingSip, setAddingSip] = useState(false);
  const [editSipOpen, setEditSipOpen] = useState(false);
  const [editingSip, setEditingSip] = useState<SipTrunk | null>(null);
  const [savingSip, setSavingSip] = useState(false);
  const [deletingSip, setDeletingSip] = useState<string | null>(null);

  // SIP form state
  const [sipLabel, setSipLabel] = useState("");
  const [sipUri, setSipUri] = useState("");
  const [sipUsername, setSipUsername] = useState("");
  const [sipPassword, setSipPassword] = useState("");
  const [sipCodec, setSipCodec] = useState("PCMU");

  // Agents & Clients for selectors
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);

  // Fetch data
  const fetchPhoneNumbers = useCallback(async () => {
    try {
      const res = await fetch("/api/phone-numbers");
      if (res.ok) {
        const data = await res.json();
        setPhoneNumbers(data);
      }
    } catch {
      toast.error("Failed to load phone numbers");
    } finally {
      setPhonesLoading(false);
    }
  }, []);

  const fetchSipTrunks = useCallback(async () => {
    try {
      const res = await fetch("/api/sip-trunks");
      if (res.ok) {
        const data = await res.json();
        setSipTrunks(data);
      }
    } catch {
      toast.error("Failed to load SIP trunks");
    } finally {
      setSipLoading(false);
    }
  }, []);

  const fetchAgentsAndClients = useCallback(async () => {
    const supabase = createClient();
    const [agentsRes, clientsRes] = await Promise.all([
      supabase.from("agents").select("id, name").order("name"),
      supabase.from("clients").select("id, name").order("name"),
    ]);
    if (agentsRes.data) setAgents(agentsRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
  }, []);

  useEffect(() => {
    fetchPhoneNumbers();
    fetchSipTrunks();
    fetchAgentsAndClients();
  }, [fetchPhoneNumbers, fetchSipTrunks, fetchAgentsAndClients]);

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

  // Purchase number
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
          clientId: purchaseClientId || undefined,
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
      setPurchaseClientId("");
      setPurchaseAgentId("");
      fetchPhoneNumbers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  };

  // Import number
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
          clientId: importClientId || undefined,
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
      setImportClientId("");
      setImportAgentId("");
      fetchPhoneNumbers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  // Delete phone number
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

  const handleSaveCallerId = async (phoneId: string) => {
    setSavingCallerId(true);
    try {
      const res = await fetch("/api/phone-numbers/caller-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumberId: phoneId,
          callerIdName: callerIdInput.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to update caller ID");
      toast.success("Caller ID updated");
      setEditingCallerId(null);
      fetchPhoneNumbers();
    } catch {
      toast.error("Failed to update caller ID");
    } finally {
      setSavingCallerId(false);
    }
  };

  // SIP trunk handlers
  const resetSipForm = () => {
    setSipLabel("");
    setSipUri("");
    setSipUsername("");
    setSipPassword("");
    setSipCodec("PCMU");
  };

  const handleAddSip = async () => {
    if (!sipLabel.trim() || !sipUri.trim()) {
      toast.error("Label and SIP URI are required");
      return;
    }
    setAddingSip(true);
    try {
      const res = await fetch("/api/sip-trunks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: sipLabel.trim(),
          sip_uri: sipUri.trim(),
          username: sipUsername.trim() || null,
          password: sipPassword || null,
          codec: sipCodec,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to add SIP trunk");
      }
      toast.success("SIP trunk added");
      setAddSipOpen(false);
      resetSipForm();
      fetchSipTrunks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add SIP trunk");
    } finally {
      setAddingSip(false);
    }
  };

  const openEditSip = (trunk: SipTrunk) => {
    setEditingSip(trunk);
    setSipLabel(trunk.label);
    setSipUri(trunk.sip_uri);
    setSipUsername(trunk.username || "");
    setSipPassword("");
    setSipCodec(trunk.codec);
    setEditSipOpen(true);
  };

  const handleEditSip = async () => {
    if (!editingSip || !sipLabel.trim() || !sipUri.trim()) {
      toast.error("Label and SIP URI are required");
      return;
    }
    setSavingSip(true);
    try {
      const payload: Record<string, unknown> = {
        label: sipLabel.trim(),
        sip_uri: sipUri.trim(),
        username: sipUsername.trim() || null,
        codec: sipCodec,
      };
      if (sipPassword) payload.password = sipPassword;

      const res = await fetch(`/api/sip-trunks/${editingSip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update SIP trunk");
      toast.success("SIP trunk updated");
      setEditSipOpen(false);
      setEditingSip(null);
      resetSipForm();
      fetchSipTrunks();
    } catch {
      toast.error("Failed to update SIP trunk");
    } finally {
      setSavingSip(false);
    }
  };

  const handleDeleteSip = async (id: string) => {
    setDeletingSip(id);
    try {
      const res = await fetch(`/api/sip-trunks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete SIP trunk");
      toast.success("SIP trunk deleted");
      fetchSipTrunks();
    } catch {
      toast.error("Failed to delete SIP trunk");
    } finally {
      setDeletingSip(null);
    }
  };

  const cnamBadge = (status: string) => {
    const styles: Record<string, string> = {
      verified: "bg-green-50 text-green-700 border-green-200",
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      none: "bg-gray-50 text-gray-500 border-gray-200",
    };
    return (
      <Badge variant="outline" className={`text-[10px] ${styles[status] || styles.none}`}>
        {status}
      </Badge>
    );
  };

  const sipStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-green-50 text-green-700 border-green-200",
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      error: "bg-red-50 text-red-700 border-red-200",
    };
    return (
      <Badge variant="outline" className={`text-[10px] ${styles[status] || styles.pending}`}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-8">
      {/* Phone Numbers Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Phone Numbers</h2>
            <p className="text-sm text-[#6b7280]">
              Manage phone numbers assigned to your agents.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
              <Download className="w-4 h-4" />
              Import Number
            </Button>
            <Button onClick={() => setPurchaseOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Purchase Number
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {phonesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-[#6b7280]" />
              </div>
            ) : phoneNumbers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Phone className="w-8 h-8 text-[#d1d5db] mb-2" />
                <p className="text-sm text-[#6b7280]">No phone numbers configured</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Assigned Agent</TableHead>
                    <TableHead>Caller ID</TableHead>
                    <TableHead>CNAM</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phoneNumbers.map((pn) => (
                    <TableRow key={pn.id}>
                      <TableCell className="font-mono text-sm">{pn.number}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{pn.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-[#6b7280]">
                        {pn.clients?.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-[#6b7280]">
                        {pn.agents?.name || "—"}
                      </TableCell>
                      <TableCell>
                        {editingCallerId === pn.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={callerIdInput}
                              onChange={(e) => setCallerIdInput(e.target.value)}
                              className="h-7 text-sm w-36"
                              placeholder="Caller ID name"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleSaveCallerId(pn.id)}
                              disabled={savingCallerId}
                            >
                              {savingCallerId ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditingCallerId(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-sm">{pn.caller_id_name || "—"}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                              onClick={() => {
                                setEditingCallerId(pn.id);
                                setCallerIdInput(pn.caller_id_name || "");
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{cnamBadge(pn.cnam_status)}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SIP Trunks Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">SIP Trunks</h2>
            <p className="text-sm text-[#6b7280]">
              Configure SIP trunk connections for your agents.
            </p>
          </div>
          <Button
            onClick={() => {
              resetSipForm();
              setAddSipOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add SIP Trunk
          </Button>
        </div>

        {sipLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-[#6b7280]" />
          </div>
        ) : sipTrunks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Phone className="w-8 h-8 text-[#d1d5db] mb-2" />
              <p className="text-sm text-[#6b7280]">No SIP trunks configured</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sipTrunks.map((trunk) => (
              <Card key={trunk.id} className="group">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{trunk.label}</CardTitle>
                    <div className="flex items-center gap-1">
                      {sipStatusBadge(trunk.status)}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => openEditSip(trunk)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600"
                            disabled={deletingSip === trunk.id}
                          >
                            {deletingSip === trunk.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete SIP Trunk?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove &ldquo;{trunk.label}&rdquo;. Any agents using this trunk will need to be reconfigured.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteSip(trunk.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[#6b7280]">URI:</span>
                    <span className="font-mono text-xs truncate">{trunk.sip_uri}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[#6b7280]">Codec:</span>
                    <Badge variant="outline" className="text-[10px]">{trunk.codec}</Badge>
                  </div>
                  {trunk.username && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[#6b7280]">User:</span>
                      <span className="text-xs">{trunk.username}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client (optional)</Label>
                <Select value={purchaseClientId} onValueChange={setPurchaseClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Agent (optional)</Label>
                <Select value={purchaseAgentId} onValueChange={setPurchaseAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client (optional)</Label>
                <Select value={importClientId} onValueChange={setImportClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Agent (optional)</Label>
                <Select value={importAgentId} onValueChange={setImportAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

      {/* Add SIP Trunk Dialog */}
      <Dialog open={addSipOpen} onOpenChange={setAddSipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add SIP Trunk</DialogTitle>
            <DialogDescription>
              Configure a new SIP trunk connection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                placeholder="e.g. Primary SIP"
                value={sipLabel}
                onChange={(e) => setSipLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>SIP URI</Label>
              <Input
                placeholder="sip:user@provider.com"
                value={sipUri}
                onChange={(e) => setSipUri(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  placeholder="Optional"
                  value={sipUsername}
                  onChange={(e) => setSipUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Optional"
                  value={sipPassword}
                  onChange={(e) => setSipPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Codec</Label>
              <Select value={sipCodec} onValueChange={setSipCodec}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PCMU">PCMU (G.711 u-law)</SelectItem>
                  <SelectItem value="PCMA">PCMA (G.711 a-law)</SelectItem>
                  <SelectItem value="G722">G.722</SelectItem>
                  <SelectItem value="opus">Opus</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSipOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSip} disabled={addingSip} className="gap-2">
              {addingSip && <Loader2 className="w-4 h-4 animate-spin" />}
              Add SIP Trunk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit SIP Trunk Dialog */}
      <Dialog open={editSipOpen} onOpenChange={setEditSipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit SIP Trunk</DialogTitle>
            <DialogDescription>
              Update SIP trunk configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={sipLabel}
                onChange={(e) => setSipLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>SIP URI</Label>
              <Input
                value={sipUri}
                onChange={(e) => setSipUri(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={sipUsername}
                  onChange={(e) => setSipUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Leave blank to keep current"
                  value={sipPassword}
                  onChange={(e) => setSipPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Codec</Label>
              <Select value={sipCodec} onValueChange={setSipCodec}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PCMU">PCMU (G.711 u-law)</SelectItem>
                  <SelectItem value="PCMA">PCMA (G.711 a-law)</SelectItem>
                  <SelectItem value="G722">G.722</SelectItem>
                  <SelectItem value="opus">Opus</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSipOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSip} disabled={savingSip} className="gap-2">
              {savingSip && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
