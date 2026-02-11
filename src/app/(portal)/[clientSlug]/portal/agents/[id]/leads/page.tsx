"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Search,
  Download,
  Upload,
  Plus,
  Tag,
  FileDown,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface LeadRow {
  id: string;
  organization_id: string;
  agent_id: string;
  phone: string;
  name: string | null;
  tags: string[];
  dynamic_vars: Record<string, unknown> | null;
  created_at: string;
}

interface ParsedLead {
  phone: string;
  name: string;
  tags: string[];
  dynamic_vars: Record<string, string>;
}

function parseCSV(text: string): ParsedLead[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  // Parse header row
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map((h) => h.trim().toLowerCase());

  const phoneIdx = headers.findIndex(
    (h) => h === "phone" || h === "phone_number" || h === "phone number"
  );
  const nameIdx = headers.findIndex(
    (h) => h === "name" || h === "full_name" || h === "full name"
  );
  const tagsIdx = headers.findIndex((h) => h === "tags" || h === "tag");

  if (phoneIdx === -1) return [];

  // Identify dynamic variable columns (any column that's not phone, name, or tags)
  const knownIndices = new Set([phoneIdx, nameIdx, tagsIdx].filter((i) => i >= 0));
  const dynamicVarColumns: { index: number; name: string }[] = [];
  headers.forEach((h, i) => {
    if (!knownIndices.has(i) && h) {
      dynamicVarColumns.push({ index: i, name: h });
    }
  });

  const results: ParsedLead[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const phone = (cols[phoneIdx] || "").trim();
    if (!phone) continue;

    const name = nameIdx >= 0 ? (cols[nameIdx] || "").trim() : "";
    const tagsRaw = tagsIdx >= 0 ? (cols[tagsIdx] || "").trim() : "";
    const tags = tagsRaw
      ? tagsRaw
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const dynamic_vars: Record<string, string> = {};
    dynamicVarColumns.forEach(({ index, name: colName }) => {
      const val = (cols[index] || "").trim();
      if (val) {
        dynamic_vars[colName] = val;
      }
    });

    results.push({ phone, name, tags, dynamic_vars });
  }

  return results;
}

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

function generateCSVTemplate(): string {
  const header = "phone,name,tags";
  const example1 = "+15551234567,John Doe,interested;hot-lead";
  const example2 = "+15559876543,Jane Smith,callback";
  return [header, example1, example2].join("\n");
}

export default function LeadsPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [itemsPerPage] = useState(25);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);

  // CSV import state
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLeads = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLeads(data);
    }
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    leads.forEach((lead) => {
      if (lead.tags) {
        lead.tags.forEach((tag) => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [leads]);

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.phone.includes(searchQuery) ||
      (lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesTags =
      selectedTags.length === 0 || selectedTags.some((tag) => lead.tags?.includes(tag));
    return matchesSearch && matchesTags;
  });

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
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
      const parsed = parseCSV(text);

      if (parsed.length === 0) {
        toast.error(
          "No valid leads found. Make sure your CSV has a 'phone' column header."
        );
        setParsedLeads([]);
        return;
      }

      // Deduplicate by phone number (keep first occurrence)
      const seen = new Set<string>();
      const deduped = parsed.filter((lead) => {
        const normalized = lead.phone.replace(/\s+/g, "");
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });

      const dupeCount = parsed.length - deduped.length;
      if (dupeCount > 0) {
        toast.info(
          `Removed ${dupeCount} duplicate phone number${dupeCount > 1 ? "s" : ""} from CSV`
        );
      }

      setParsedLeads(deduped);
    };
    reader.readAsText(file);

    // Reset file input so the same file can be re-selected
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);

      if (parsed.length === 0) {
        toast.error(
          "No valid leads found. Make sure your CSV has a 'phone' column header."
        );
        setParsedLeads([]);
        return;
      }

      const seen = new Set<string>();
      const deduped = parsed.filter((lead) => {
        const normalized = lead.phone.replace(/\s+/g, "");
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });

      const dupeCount = parsed.length - deduped.length;
      if (dupeCount > 0) {
        toast.info(
          `Removed ${dupeCount} duplicate phone number${dupeCount > 1 ? "s" : ""} from CSV`
        );
      }

      setParsedLeads(deduped);
    };
    reader.readAsText(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDownloadTemplate() {
    const csv = generateCSVTemplate();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportLeads() {
    if (parsedLeads.length === 0) {
      toast.error("No leads to import. Upload a CSV file first.");
      return;
    }

    setImporting(true);

    try {
      const supabase = createClient();

      // Get the current user's organization_id
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to import leads");
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!userData?.organization_id) {
        toast.error("Organization not found");
        return;
      }

      // Also deduplicate against existing leads for this agent
      const existingPhones = new Set(leads.map((l) => l.phone.replace(/\s+/g, "")));
      const newLeads = parsedLeads.filter(
        (lead) => !existingPhones.has(lead.phone.replace(/\s+/g, ""))
      );
      const skippedCount = parsedLeads.length - newLeads.length;

      if (newLeads.length === 0) {
        toast.info("All leads already exist for this agent. No new leads to import.");
        setImporting(false);
        return;
      }

      // Insert in batches of 100
      const batchSize = 100;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < newLeads.length; i += batchSize) {
        const batch = newLeads.slice(i, i + batchSize);

        const { data, error } = await supabase
          .from("leads")
          .upsert(
            batch.map((lead) => ({
              organization_id: userData.organization_id,
              agent_id: agentId,
              phone: lead.phone,
              name: lead.name || null,
              tags: lead.tags,
              dynamic_vars:
                Object.keys(lead.dynamic_vars).length > 0
                  ? lead.dynamic_vars
                  : null,
            })),
            { onConflict: "phone,agent_id" }
          )
          .select();

        if (error) {
          errorCount += batch.length;
        } else {
          successCount += data.length;
        }
      }

      if (successCount > 0) {
        toast.success(
          `Successfully imported ${successCount} lead${successCount > 1 ? "s" : ""}` +
            (skippedCount > 0
              ? `. ${skippedCount} duplicate${skippedCount > 1 ? "s" : ""} skipped.`
              : "") +
            (errorCount > 0
              ? ` ${errorCount} failed.`
              : "")
        );
      }

      if (errorCount > 0 && successCount === 0) {
        toast.error(`Failed to import leads. ${errorCount} error${errorCount > 1 ? "s" : ""}.`);
      }

      // Close dialog and reset state
      setImportOpen(false);
      setParsedLeads([]);
      setCsvFileName(null);

      // Refresh leads list
      await fetchLeads();
    } catch {
      toast.error("Something went wrong during import. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  function handleImportClose(open: boolean) {
    setImportOpen(open);
    if (!open) {
      setParsedLeads([]);
      setCsvFileName(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your lead database</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTagsOpen(true)}>
            <Tag className="w-4 h-4 mr-2" />
            Lead Tags
          </Button>
          <Dialog open={importOpen} onOpenChange={handleImportClose}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Import Leads</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6 py-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">CSV Upload Rules</h3>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>&bull; Phone number is required for each lead</li>
                      <li>&bull; Name is optional</li>
                      <li>&bull; Tags should be separated by semicolons</li>
                      <li>&bull; Dynamic variables use key=value format</li>
                      <li>&bull; Duplicate phone numbers will be deduplicated</li>
                    </ul>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                  <div
                    className="border-2 border-dashed border-border/60 rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all duration-200 bg-white"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    {csvFileName ? (
                      <>
                        <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                        <p className="text-sm font-medium text-foreground mb-1">
                          {csvFileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {parsedLeads.length} lead{parsedLeads.length !== 1 ? "s" : ""}{" "}
                          found. Click to upload a different file.
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-1">
                          Drag & drop CSV file here
                        </p>
                        <p className="text-xs text-muted-foreground">or click to browse</p>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">Extracted Leads Preview</h3>
                  <div className="border rounded-lg min-h-[200px] max-h-[320px] overflow-auto bg-muted/50">
                    {parsedLeads.length > 0 ? (
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted">
                          <tr className="border-b">
                            <th className="text-left px-2 py-1.5 font-medium">Phone</th>
                            <th className="text-left px-2 py-1.5 font-medium">Name</th>
                            <th className="text-left px-2 py-1.5 font-medium">Tags</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedLeads.slice(0, 50).map((lead, idx) => (
                            <tr key={idx} className="border-b last:border-0">
                              <td className="px-2 py-1.5 font-mono">{lead.phone}</td>
                              <td className="px-2 py-1.5">{lead.name || "\u2014"}</td>
                              <td className="px-2 py-1.5">
                                <div className="flex flex-wrap gap-0.5">
                                  {lead.tags.map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="outline"
                                      className="text-[10px] px-1 py-0"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        Upload a CSV file to preview extracted leads
                      </p>
                    )}
                    {parsedLeads.length > 50 && (
                      <p className="text-xs text-muted-foreground text-center py-2 border-t">
                        Showing 50 of {parsedLeads.length} leads
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleImportClose(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary hover:bg-primary/90"
                  onClick={handleImportLeads}
                  disabled={parsedLeads.length === 0 || importing}
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      Import {parsedLeads.length > 0 ? `${parsedLeads.length} ` : ""}
                      Lead{parsedLeads.length !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Search + Tag Filters */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl shadow-none focus:shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              className={`cursor-pointer transition-all duration-200 ${
                selectedTags.includes(tag)
                  ? "bg-primary hover:bg-primary/90"
                  : "hover:bg-primary/5 hover:text-primary hover:border-primary"
              }`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
              {selectedTags.includes(tag) && <X className="w-3 h-3 ml-1" />}
            </Badge>
          ))}
        </div>
      </div>

      {/* Leads Table */}
      {loading ? (
        <Card className="glass-card rounded-xl">
          <CardContent className="p-0">
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 py-2">
                  <Skeleton className="h-4 w-28 font-mono shimmer" />
                  <Skeleton className="h-4 w-24 shimmer" />
                  <Skeleton className="h-5 w-16 rounded-full shimmer" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="animate-fade-in-up glass-card rounded-xl">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="premium-row border-border/50">
                    <TableCell className="font-mono text-sm">{lead.phone}</TableCell>
                    <TableCell className="font-medium">{lead.name || "\u2014"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(lead.tags || []).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLeads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      {searchQuery || selectedTags.length > 0
                        ? "No leads match your current filters"
                        : "No leads yet. Import leads to get started."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredLeads.length} of {leads.length} leads
        </p>
        <Select defaultValue="25">
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
            <SelectItem value="100">100 per page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lead Tags Modal */}
      <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lead Tags</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Manage Tags</Label>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-sm py-1 px-3">
                    {tag}
                  </Badge>
                ))}
                {allTags.length === 0 && (
                  <p className="text-xs text-muted-foreground">No tags found. Tags are derived from your leads.</p>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <Label>How Tags Work</Label>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Tags help you organize and filter your leads based on their status, interest level, or any category you choose.</p>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                  <p className="font-medium text-foreground text-xs">Quick Tips</p>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    <li>Tags are automatically created from your imported lead data</li>
                    <li>Use the filter bar above to quickly find leads by tag</li>
                    <li>Tags like &quot;Interested&quot; or &quot;Follow Up&quot; help prioritize outreach</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
