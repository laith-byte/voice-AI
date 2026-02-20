"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { FeatureGate } from "@/components/portal/feature-gate";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Search,
  Plus,
  Megaphone,
  Calendar,
  Clock,
  Phone,
  Users,
  Upload,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Pause,
  Play,
  CheckCircle2,
  FileDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface CampaignRow {
  id: string;
  organization_id: string;
  agent_id: string;
  name: string;
  status: string;
  start_date: string | null;
  calling_days: string[] | null;
  calling_hours_start: string | null;
  calling_hours_end: string | null;
  timezone_mode: string | null;
  timezone: string | null;
  retry_attempts: number | null;
  retry_interval_hours: number | null;
  calling_rate: number | null;
  calling_rate_minutes: number | null;
  phone_number_ids: string[] | null;
  cycle_numbers: boolean | null;
  leads_source: string | null;
  leads_tag_filter: string | null;
  total_leads: number;
  completed_leads: number;
  created_at: string;
}

interface PhoneNumberRow {
  id: string;
  number: string;
}

interface LeadPreviewRow {
  id: string;
  phone: string;
  name: string | null;
}

interface ParsedLead {
  phone: string;
  name: string;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-gray-500/10", text: "text-gray-600", dot: "bg-gray-400" },
  active: { bg: "bg-green-500/10", text: "text-green-600", dot: "bg-green-500" },
  paused: { bg: "bg-yellow-500/10", text: "text-yellow-600", dot: "bg-yellow-500" },
  completed: { bg: "bg-primary/10", text: "text-primary", dot: "bg-primary" },
};

const DAYS = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

const DEFAULT_CALLING_DAYS = ["mon", "tue", "wed", "thu", "fri"];

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

function parseCampaignCSV(text: string): ParsedLead[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const phoneIdx = headers.findIndex(
    (h) => h === "phone" || h === "phone_number" || h === "phone number"
  );
  const nameIdx = headers.findIndex(
    (h) => h === "name" || h === "full_name" || h === "full name"
  );
  if (phoneIdx === -1) return [];

  const results: ParsedLead[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const phone = (cols[phoneIdx] || "").trim();
    if (!phone) continue;
    const normalized = phone.replace(/\s+/g, "");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const name = nameIdx >= 0 ? (cols[nameIdx] || "").trim() : "";
    results.push({ phone, name });
  }

  return results;
}

export default function CampaignsPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);

  // Create campaign form state
  const [campaignName, setCampaignName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [leadsSource, setLeadsSource] = useState("existing");
  const [leadsTagFilter, setLeadsTagFilter] = useState("all");
  const [selectedPhoneNumberIds, setSelectedPhoneNumberIds] = useState<string[]>([]);
  const [cycleNumbers, setCycleNumbers] = useState(false);
  const [callingDays, setCallingDays] = useState<string[]>(DEFAULT_CALLING_DAYS);
  const [callingHoursStart, setCallingHoursStart] = useState("09:00");
  const [callingHoursEnd, setCallingHoursEnd] = useState("17:00");
  const [timezoneMode, setTimezoneMode] = useState("auto");
  const [timezone, setTimezone] = useState("");
  const [retryAttempts, setRetryAttempts] = useState(2);
  const [retryIntervalHours, setRetryIntervalHours] = useState(4);
  const [callingRate, setCallingRate] = useState(5);
  const [callingRateMinutes, setCallingRateMinutes] = useState(1);

  // CSV upload state for campaign creation
  const [csvLeads, setCsvLeads] = useState<ParsedLead[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Data for the create form
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberRow[]>([]);
  const [leadsPreview, setLeadsPreview] = useState<LeadPreviewRow[]>([]);
  const [leadsPreviewTotal, setLeadsPreviewTotal] = useState(0);
  const [leadTags, setLeadTags] = useState<string[]>([]);

  // Edit campaign state
  const [editingCampaign, setEditingCampaign] = useState<CampaignRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      toast.error("Failed to load campaigns");
    } else if (data) {
      setCampaigns(data);
    }
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Fetch phone numbers and leads preview when the create dialog opens
  const fetchCreateFormData = useCallback(async () => {
    const supabase = createClient();

    // Fetch phone numbers scoped via RLS (defense-in-depth)
    const { data: phones } = await supabase
      .from("phone_numbers")
      .select("id, number")
      .limit(100);

    if (phones) {
      setPhoneNumbers(phones);
    }

    // Fetch first 5 leads for preview + total count
    let leadsQuery = supabase
      .from("leads")
      .select("id, phone, name", { count: "exact" })
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (leadsTagFilter !== "all" && leadsTagFilter !== "untagged") {
      leadsQuery = leadsQuery.contains("tags", [leadsTagFilter]);
    }

    const { data: previewLeads, count } = await leadsQuery;

    if (previewLeads) {
      setLeadsPreview(previewLeads);
      setLeadsPreviewTotal(count ?? previewLeads.length);
    }

    // Derive unique tags from leads
    const { data: allLeads } = await supabase
      .from("leads")
      .select("tags")
      .eq("agent_id", agentId);

    if (allLeads) {
      const tagSet = new Set<string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allLeads.forEach((lead: any) => {
        if (lead.tags) {
          lead.tags.forEach((tag: string) => tagSet.add(tag));
        }
      });
      setLeadTags(Array.from(tagSet).sort());
    }
  }, [agentId, leadsTagFilter]);

  useEffect(() => {
    if (createOpen) {
      fetchCreateFormData();
    }
  }, [createOpen, fetchCreateFormData]);

  // Re-fetch leads preview when tag filter changes and dialog is open
  useEffect(() => {
    if (!createOpen || leadsSource !== "existing") return;
    const supabase = createClient();

    let leadsQuery = supabase
      .from("leads")
      .select("id, phone, name", { count: "exact" })
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (leadsTagFilter !== "all" && leadsTagFilter !== "untagged") {
      leadsQuery = leadsQuery.contains("tags", [leadsTagFilter]);
    }

    leadsQuery.then(({ data, count }) => {
      if (data) {
        setLeadsPreview(data);
        setLeadsPreviewTotal(count ?? data.length);
      }
    });
  }, [leadsTagFilter, createOpen, leadsSource, agentId]);

  function toggleCallingDay(dayId: string) {
    setCallingDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  }

  function resetForm() {
    setCampaignName("");
    setStartDate("");
    setLeadsSource("existing");
    setLeadsTagFilter("all");
    setSelectedPhoneNumberIds([]);
    setCycleNumbers(false);
    setCallingDays(DEFAULT_CALLING_DAYS);
    setCallingHoursStart("09:00");
    setCallingHoursEnd("17:00");
    setTimezoneMode("auto");
    setTimezone("");
    setRetryAttempts(2);
    setRetryIntervalHours(4);
    setCallingRate(5);
    setCallingRateMinutes(1);
    setCsvLeads([]);
    setCsvFileName(null);
  }

  function handleCsvFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCampaignCSV(text);
      if (parsed.length === 0) {
        toast.error("No valid leads found. Make sure your CSV has a 'phone' column.");
        setCsvLeads([]);
        return;
      }
      setCsvLeads(parsed);
      toast.success(`${parsed.length} lead${parsed.length > 1 ? "s" : ""} found in CSV`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) return;
    setCreating(true);

    try {
      // If CSV upload, first import leads via API
      let totalLeadsCount = leadsPreviewTotal;
      if (leadsSource === "upload" && csvLeads.length > 0) {
        const importRes = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: agentId,
            leads: csvLeads.map((l) => ({
              phone: l.phone,
              name: l.name || null,
              tags: [],
              dynamic_vars: {},
            })),
          }),
        });
        if (!importRes.ok) {
          toast.error("Failed to import CSV leads");
          setCreating(false);
          return;
        }
        totalLeadsCount = csvLeads.length;
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCreating(false);
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!userData) {
        setCreating(false);
        return;
      }

      const { error } = await supabase.from("campaigns").insert({
        organization_id: userData.organization_id,
        agent_id: agentId,
        name: campaignName.trim(),
        status: "draft",
        start_date: startDate || null,
        calling_days: callingDays,
        calling_hours_start: callingHoursStart,
        calling_hours_end: callingHoursEnd,
        timezone_mode: timezoneMode,
        timezone: timezoneMode === "fixed" ? timezone : null,
        retry_attempts: retryAttempts,
        retry_interval_hours: retryIntervalHours,
        calling_rate: callingRate,
        calling_rate_minutes: callingRateMinutes,
        phone_number_ids: selectedPhoneNumberIds,
        cycle_numbers: cycleNumbers,
        leads_source: leadsSource,
        leads_tag_filter: leadsTagFilter === "all" ? null : leadsTagFilter,
        total_leads: totalLeadsCount,
        completed_leads: 0,
      });

      if (error) {
        toast.error("Failed to create campaign");
      } else {
        toast.success("Campaign created successfully!");
        setCreateOpen(false);
        resetForm();
        fetchCampaigns();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setCreating(false);
  };

  async function handleDeleteCampaign(campaign: CampaignRow) {
    if (campaign.status === "active") {
      toast.error("Cannot delete an active campaign. Pause it first.");
      return;
    }
    if (!window.confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Failed to delete campaign");
      }
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
      toast.success("Campaign deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete campaign");
    }
  }

  async function handleStatusChange(campaign: CampaignRow, newStatus: string) {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Failed to update campaign");
      }
      const updated = await res.json();
      setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success(`Campaign ${newStatus}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update campaign");
    }
  }

  function openEditCampaign(campaign: CampaignRow) {
    setEditingCampaign(campaign);
    setEditName(campaign.name);
  }

  async function handleSaveEditCampaign() {
    if (!editingCampaign) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${editingCampaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Failed to update campaign");
      }
      const updated = await res.json();
      setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingCampaign(null);
      toast.success("Campaign updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update campaign");
    } finally {
      setEditSaving(false);
    }
  }

  const filtered = campaigns.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "\u2014";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getProgressPercent(completed: number, total: number) {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }

  return (
    <FeatureGate feature="campaigns">
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage outbound calling campaigns</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Create
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-5 gap-6 py-4">
              {/* Left side - Form */}
              <div className="col-span-3 space-y-5">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input
                    placeholder="e.g., Q1 Sales Outreach"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Start Date
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                {/* Leads to Call */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Leads to Call
                  </Label>
                  <RadioGroup value={leadsSource} onValueChange={setLeadsSource} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="existing" id="existing" />
                      <Label htmlFor="existing" className="font-normal text-sm">Select existing</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="upload" id="upload" />
                      <Label htmlFor="upload" className="font-normal text-sm">Upload CSV</Label>
                    </div>
                  </RadioGroup>

                  {leadsSource === "existing" ? (
                    <Select value={leadsTagFilter} onValueChange={setLeadsTagFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by tag: All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Leads</SelectItem>
                        <SelectItem value="untagged">Untagged</SelectItem>
                        {leadTags.map((tag) => (
                          <SelectItem key={tag} value={tag}>
                            {tag}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div>
                      <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleCsvFileSelect}
                      />
                      <div
                        className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                        onClick={() => csvInputRef.current?.click()}
                      >
                        {csvFileName ? (
                          <>
                            <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-1" />
                            <p className="text-xs font-medium">{csvFileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {csvLeads.length} lead{csvLeads.length !== 1 ? "s" : ""} found
                            </p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                            <p className="text-xs text-muted-foreground">Click to upload CSV</p>
                            <p className="text-[10px] text-muted-foreground">Requires a &quot;phone&quot; column</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Phone Numbers */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone Numbers
                  </Label>
                  <Select
                    value={selectedPhoneNumberIds[0] || ""}
                    onValueChange={(val) => setSelectedPhoneNumberIds([val])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outbound number" />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneNumbers.map((pn) => (
                        <SelectItem key={pn.id} value={pn.id}>
                          {pn.number}
                        </SelectItem>
                      ))}
                      {phoneNumbers.length === 0 && (
                        <SelectItem value="none" disabled>
                          No phone numbers available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="cycle"
                      checked={cycleNumbers}
                      onCheckedChange={(checked) => setCycleNumbers(!!checked)}
                    />
                    <Label htmlFor="cycle" className="text-sm font-normal">Cycle through numbers</Label>
                  </div>
                </div>

                {/* Calling Days */}
                <div className="space-y-2">
                  <Label>Calling Days</Label>
                  <div className="flex gap-2">
                    {DAYS.map((day) => (
                      <div key={day.id} className="flex items-center gap-1.5">
                        <Checkbox
                          id={day.id}
                          checked={callingDays.includes(day.id)}
                          onCheckedChange={() => toggleCallingDay(day.id)}
                        />
                        <Label htmlFor={day.id} className="text-xs font-normal">{day.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calling Hours */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Calling Hours
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={callingHoursStart}
                      onChange={(e) => setCallingHoursStart(e.target.value)}
                      className="w-[130px]"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={callingHoursEnd}
                      onChange={(e) => setCallingHoursEnd(e.target.value)}
                      className="w-[130px]"
                    />
                  </div>
                </div>

                {/* Time Zone */}
                <div className="space-y-2">
                  <Label>Time Zone</Label>
                  <RadioGroup value={timezoneMode} onValueChange={setTimezoneMode} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="auto" id="auto-tz" />
                      <Label htmlFor="auto-tz" className="font-normal text-sm">Auto (per lead)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fixed" id="fixed-tz" />
                      <Label htmlFor="fixed-tz" className="font-normal text-sm">Fixed</Label>
                    </div>
                  </RadioGroup>
                  {timezoneMode === "fixed" && (
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern (EST)</SelectItem>
                        <SelectItem value="America/Chicago">Central (CST)</SelectItem>
                        <SelectItem value="America/Denver">Mountain (MST)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific (PST)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Retry & Rate */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Retry Attempts</Label>
                    <Input
                      type="number"
                      value={retryAttempts}
                      onChange={(e) => setRetryAttempts(Number(e.target.value))}
                      min="0"
                      max="5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Retry Interval (hours)</Label>
                    <Input
                      type="number"
                      value={retryIntervalHours}
                      onChange={(e) => setRetryIntervalHours(Number(e.target.value))}
                      min="1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Calling Rate</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={callingRate}
                      onChange={(e) => setCallingRate(Number(e.target.value))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">calls per</span>
                    <Input
                      type="number"
                      value={callingRateMinutes}
                      onChange={(e) => setCallingRateMinutes(Number(e.target.value))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">minute(s)</span>
                  </div>
                </div>
              </div>

              {/* Right side - Leads Preview */}
              <div className="col-span-2">
                <h3 className="text-sm font-medium mb-3">Leads Preview</h3>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Phone</TableHead>
                        <TableHead className="text-xs">Name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadsSource === "upload" && csvLeads.length > 0 ? (
                        csvLeads.slice(0, 5).map((lead, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs font-mono">{lead.phone}</TableCell>
                            <TableCell className="text-xs">{lead.name || "\u2014"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        leadsPreview.map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell className="text-xs font-mono">{lead.phone}</TableCell>
                            <TableCell className="text-xs">{lead.name || "\u2014"}</TableCell>
                          </TableRow>
                        ))
                      )}
                      {((leadsSource === "upload" && csvLeads.length === 0) ||
                        (leadsSource === "existing" && leadsPreview.length === 0)) && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-xs text-muted-foreground text-center py-4">
                            {leadsSource === "upload" ? "Upload a CSV to preview leads" : "No leads found for this agent"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <div className="p-2 border-t text-center">
                    <p className="text-xs text-muted-foreground">
                      {leadsSource === "upload"
                        ? `${csvLeads.length} leads from CSV`
                        : `Showing ${leadsPreview.length} of ${leadsPreviewTotal} leads`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={handleCreateCampaign}
                disabled={!campaignName.trim() || creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Campaign"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search campaigns..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 rounded-xl shadow-none focus:shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>

      {/* Campaigns Table */}
      {loading ? (
        <Card className="glass-card rounded-xl">
          <CardContent className="p-0">
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 py-2">
                  <Skeleton className="h-4 w-4 rounded shimmer" />
                  <Skeleton className="h-4 w-32 shimmer" />
                  <Skeleton className="h-5 w-16 rounded-full shimmer" />
                  <Skeleton className="h-2 w-24 rounded-full shimmer" />
                  <Skeleton className="h-4 w-12 shimmer" />
                  <Skeleton className="h-4 w-20 ml-auto shimmer" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="animate-fade-in-up glass-card rounded-xl">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((campaign) => {
                    const statusConfig = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
                    return (
                    <TableRow key={campaign.id} className="premium-row border-border/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Megaphone className="w-4 h-4 text-primary" />
                          <span className="font-medium">{campaign.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusConfig.bg} ${statusConfig.text} border-0`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot} mr-1.5`} />
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <Progress
                            value={getProgressPercent(campaign.completed_leads, campaign.total_leads)}
                            className="h-2"
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {getProgressPercent(campaign.completed_leads, campaign.total_leads)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {campaign.completed_leads}/{campaign.total_leads}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(campaign.start_date)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(campaign.created_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditCampaign(campaign)}>
                              <Pencil className="w-3.5 h-3.5 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {campaign.status === "active" ? (
                              <DropdownMenuItem onClick={() => handleStatusChange(campaign, "paused")}>
                                <Pause className="w-3.5 h-3.5 mr-2" />
                                Pause
                              </DropdownMenuItem>
                            ) : campaign.status === "paused" || campaign.status === "draft" ? (
                              <DropdownMenuItem onClick={() => handleStatusChange(campaign, "active")}>
                                <Play className="w-3.5 h-3.5 mr-2" />
                                {campaign.status === "draft" ? "Activate" : "Resume"}
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteCampaign(campaign)}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center mx-auto mb-4">
                <Megaphone className="w-10 h-10 text-muted-foreground/60" />
              </div>
              <h3 className="font-medium text-lg mb-1">No campaigns found</h3>
              <p className="text-sm text-muted-foreground">Create your first campaign to get started</p>
            </div>
          )}
        </>
      )}

      {/* Edit Campaign Dialog */}
      <Dialog open={!!editingCampaign} onOpenChange={(open) => { if (!open) setEditingCampaign(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Campaign name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCampaign(null)}>Cancel</Button>
            <Button onClick={handleSaveEditCampaign} disabled={editSaving || !editName.trim()}>
              {editSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </FeatureGate>
  );
}
