"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { FeatureGate } from "@/components/portal/feature-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  FileText,
  Globe,
  Type,
  Loader2,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface KBSource {
  id: string;
  source_type: "text" | "url";
  name: string;
  content: string | null;
  url: string | null;
  status: string;
  retell_kb_id: string | null;
  created_at: string;
}

export default function KnowledgeBasePage() {
  const params = useParams();
  const agentId = params.id as string;

  const [sources, setSources] = useState<KBSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Add form state
  const [sourceType, setSourceType] = useState<"text" | "url">("text");
  const [sourceName, setSourceName] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge-base`);
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch {
      toast.error("Failed to load knowledge base.");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleAdd = async () => {
    if (!sourceName.trim()) {
      toast.error("Please enter a name.");
      return;
    }
    if (sourceType === "text" && !sourceContent.trim()) {
      toast.error("Please enter some content.");
      return;
    }
    if (sourceType === "url" && !sourceUrl.trim()) {
      toast.error("Please enter a URL.");
      return;
    }

    setAdding(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge-base`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: sourceType,
          name: sourceName.trim(),
          content: sourceType === "text" ? sourceContent.trim() : undefined,
          url: sourceType === "url" ? sourceUrl.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to add source");
      }

      const newSource = await res.json();
      setSources((prev) => [newSource, ...prev]);
      setAddOpen(false);
      setSourceName("");
      setSourceContent("");
      setSourceUrl("");
      setSourceType("text");
      toast.success("Knowledge base source added!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add source.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (sourceId: string) => {
    setDeleting(sourceId);
    try {
      const res = await fetch(
        `/api/agents/${agentId}/knowledge-base/${sourceId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete");
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      toast.success("Source deleted.");
    } catch {
      toast.error("Failed to delete source.");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-1 mb-6">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <FeatureGate feature="knowledge_base">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="page-header-glow">
            <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-primary/40 mb-3" />
            <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
            <p className="text-muted-foreground/80 text-sm mt-1">
              Add content your AI agent can reference when answering questions.
            </p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Source
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Knowledge Base Source</DialogTitle>
                <DialogDescription>
                  Add text content or a URL for your AI agent to reference.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Source Type</Label>
                  <Select
                    value={sourceType}
                    onValueChange={(v) => setSourceType(v as "text" | "url")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text Content</SelectItem>
                      <SelectItem value="url">Website URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder="e.g. Company Policies, Product Catalog"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                  />
                </div>

                {sourceType === "text" && (
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <Textarea
                      placeholder="Paste your text content here..."
                      value={sourceContent}
                      onChange={(e) => setSourceContent(e.target.value)}
                      rows={8}
                      className="resize-none"
                    />
                  </div>
                )}

                {sourceType === "url" && (
                  <div className="space-y-2">
                    <Label>URL</Label>
                    <Input
                      placeholder="https://www.example.com/page"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      The page content will be crawled and indexed for your agent.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={adding} className="gap-2">
                  {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add Source
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-lg mb-1">No sources yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Add text content or URLs to help your AI agent answer questions
              more accurately.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {sources.map((source) => (
              <Card
                key={source.id}
                className="group hover:shadow-sm transition-shadow"
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                    {source.source_type === "url" ? (
                      <Globe className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <Type className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm truncate">
                        {source.name}
                      </h3>
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-4 ${
                          source.status === "active"
                            ? "text-green-700 border-green-200 bg-green-50"
                            : "text-amber-700 border-amber-200 bg-amber-50"
                        }`}
                      >
                        {source.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {source.source_type === "url"
                        ? source.url
                        : source.content
                        ? source.content.slice(0, 120) + (source.content.length > 120 ? "..." : "")
                        : "No content"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      Added{" "}
                      {new Date(source.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(source.id)}
                    disabled={deleting === source.id}
                  >
                    {deleting === source.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 rounded-lg border border-amber-200 bg-amber-50/50">
          <div className="flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Knowledge Base Tips
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Keep content concise and factual. Your AI agent performs best
                with well-structured information. Avoid duplicating content
                already in your FAQs or services.
              </p>
            </div>
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
