"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
  phone_number: string;
}

interface LeadPreviewRow {
  id: string;
  phone: string;
  name: string | null;
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

  // Data for the create form
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberRow[]>([]);
  const [leadsPreview, setLeadsPreview] = useState<LeadPreviewRow[]>([]);
  const [leadsPreviewTotal, setLeadsPreviewTotal] = useState(0);
  const [leadTags, setLeadTags] = useState<string[]>([]);

  const fetchCampaigns = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });

    if (!error && data) {
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

    // Fetch phone numbers available for this agent
    const { data: phones } = await supabase
      .from("phone_numbers")
      .select("id, phone_number");

    if (phones) {
      setPhoneNumbers(phones);
    }

    // Fetch first 5 leads for preview + total count
    const { data: previewLeads, count } = await supabase
      .from("leads")
      .select("id, phone, name", { count: "exact" })
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(5);

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
  }, [agentId]);

  useEffect(() => {
    if (createOpen) {
      fetchCreateFormData();
    }
  }, [createOpen, fetchCreateFormData]);

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
  }

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) return;
    setCreating(true);

    const supabase = createClient();

    // Get user's organization_id
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
      total_leads: 0,
      completed_leads: 0,
    });

    if (!error) {
      setCreateOpen(false);
      resetForm();
      fetchCampaigns();
    }
    setCreating(false);
  };

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
                    <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                      <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Upload CSV</p>
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
                      <SelectValue placeholder="Select outbound number(s)" />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneNumbers.map((pn) => (
                        <SelectItem key={pn.id} value={pn.id}>
                          {pn.phone_number}
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
                      {leadsPreview.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="text-xs font-mono">{lead.phone}</TableCell>
                          <TableCell className="text-xs">{lead.name || "\u2014"}</TableCell>
                        </TableRow>
                      ))}
                      {leadsPreview.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-xs text-muted-foreground text-center py-4">
                            No leads found for this agent
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <div className="p-2 border-t text-center">
                    <p className="text-xs text-muted-foreground">
                      Showing {leadsPreview.length} of {leadsPreviewTotal} leads
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
    </div>
    </FeatureGate>
  );
}
