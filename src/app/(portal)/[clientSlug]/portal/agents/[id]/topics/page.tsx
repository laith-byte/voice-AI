"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { FeatureGate } from "@/components/portal/feature-gate";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Tags, Loader2, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface TopicRow {
  id: string;
  agent_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

const DOT_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-yellow-500",
  "bg-red-500",
];

export default function TopicsPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDescription, setNewTopicDescription] = useState("");

  const fetchTopics = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("topics")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load topics");
    } else if (data) {
      setTopics(data);
    }
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const handleAddTopic = async () => {
    if (!newTopicName.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const { error } = await supabase.from("topics").insert({
      agent_id: agentId,
      name: newTopicName.trim(),
      description: newTopicDescription.trim() || null,
    });

    if (error) {
      toast.error("Failed to create topic");
    } else {
      setDialogOpen(false);
      setNewTopicName("");
      setNewTopicDescription("");
      fetchTopics();
    }
    setCreating(false);
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!window.confirm("Are you sure you want to delete this topic?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("topics").delete().eq("id", topicId);
    if (error) {
      toast.error("Failed to delete topic");
    } else {
      toast.success("Topic deleted");
      fetchTopics();
    }
  };

  const filteredTopics = topics.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <FeatureGate feature="topics">
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Topics</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage conversation topics for AI auto-tagging</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 group">
              <Plus className="w-4 h-4 mr-2 transition-transform duration-200 group-hover:rotate-90" />
              Add Topic
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Topic</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>
                  Topic Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g., Pricing Inquiry"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Topic Description</Label>
                <Textarea
                  placeholder="Describe what this topic covers..."
                  value={newTopicDescription}
                  onChange={(e) => setNewTopicDescription(e.target.value)}
                  className="focus:shadow-sm transition-shadow"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={handleAddTopic}
                disabled={!newTopicName.trim() || creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Topic"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl shadow-none focus:shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <Card className="glass-card rounded-xl">
          <CardContent className="p-0">
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 py-2">
                  <Skeleton className="h-2 w-2 rounded-full shimmer" />
                  <Skeleton className="h-4 w-32 shimmer" />
                  <Skeleton className="h-4 w-48 hidden md:block shimmer" />
                  <Skeleton className="h-4 w-20 ml-auto shimmer" />
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
                <TableRow className="border-border/50">
                  <TableHead>Topic</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTopics.map((topic, index) => (
                  <TableRow key={topic.id} className="premium-row border-border/50">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${DOT_COLORS[index % DOT_COLORS.length]}`} />
                        <span className="font-medium">{topic.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                      {topic.description || "\u2014"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(topic.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteTopic(topic.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTopics.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 empty-state-circle">
                        <Tags className="w-7 h-7 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-medium mb-1">
                        {searchQuery ? "No topics match your search" : "No topics yet"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {searchQuery ? "Try adjusting your search query" : "Add your first topic to get started"}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </FeatureGate>
  );
}
