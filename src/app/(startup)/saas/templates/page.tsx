"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, MoreVertical, Bot, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { AgentTemplate } from "@/types/database";

export default function SaaSTemplatesPage() {
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    text_provider: "openai",
    voice_provider: "retell",
    retell_agent_id: "",
  });

  // Deleting state
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: dbUser } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (!dbUser) return;

      setOrgId(dbUser.organization_id);

      const { data, error } = await supabase
        .from("agent_templates")
        .select("*")
        .eq("organization_id", dbUser.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates((data as AgentTemplate[]) || []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load templates"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreateTemplate = async () => {
    if (!orgId || !newTemplate.name.trim()) return;
    setCreating(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("agent_templates").insert({
        organization_id: orgId,
        name: newTemplate.name.trim(),
        description: newTemplate.description.trim() || null,
        text_provider: newTemplate.text_provider,
        voice_provider: newTemplate.voice_provider,
        retell_agent_id: newTemplate.retell_agent_id.trim() || null,
      });

      if (error) throw error;

      toast.success("Template created successfully");
      setDialogOpen(false);
      setNewTemplate({
        name: "",
        description: "",
        text_provider: "openai",
        voice_provider: "retell",
        retell_agent_id: "",
      });
      fetchTemplates();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create template"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    setDeleting(id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("agent_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Template deleted");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete template"
      );
    } finally {
      setDeleting(null);
    }
  };

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Description */}
      <p className="text-sm text-[#6b7280]">
        Curate templates that your clients can choose from when creating their
        agents.
      </p>

      {/* Provider Selection (read-only display info) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-[#111827] mb-2">
            Text Provider
          </label>
          <Select
            value={newTemplate.text_provider}
            onValueChange={(val) =>
              setNewTemplate({ ...newTemplate, text_provider: val })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select text provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="google">Google AI</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#111827] mb-2">
            Voice Provider
          </label>
          <Select
            value={newTemplate.voice_provider}
            onValueChange={(val) =>
              setNewTemplate({ ...newTemplate, voice_provider: val })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select voice provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="retell">Voice AI</SelectItem>
              <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
              <SelectItem value="vapi">Vapi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="relative">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-[#2563eb]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#111827]">
                    {template.name}
                  </h3>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4 text-[#6b7280]" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-red-600"
                      disabled={deleting === template.id}
                      onClick={() => handleDeleteTemplate(template.id)}
                    >
                      {deleting === template.id ? "Deleting..." : "Delete"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="text-xs text-[#6b7280] mb-2 line-clamp-2">
                {template.description}
              </p>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs bg-gray-100 text-[#6b7280] px-2 py-0.5 rounded">
                  {template.text_provider}
                </span>
                <span className="text-xs bg-gray-100 text-[#6b7280] px-2 py-0.5 rounded">
                  {template.voice_provider}
                </span>
              </div>
              <p className="text-xs text-[#6b7280]">
                {formatDate(template.created_at)}
              </p>
            </CardContent>
          </Card>
        ))}

        {/* Create Template Card */}
        <button
          className="border-2 border-dashed border-[#e5e7eb] rounded-lg p-5 flex flex-col items-center justify-center gap-2 hover:border-[#2563eb] hover:bg-blue-50/50 transition-colors min-h-[160px] cursor-pointer"
          onClick={() => setDialogOpen(true)}
        >
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <Plus className="h-5 w-5 text-[#6b7280]" />
          </div>
          <span className="text-sm font-medium text-[#6b7280]">
            Create Template
          </span>
        </button>
      </div>

      {/* Add Template Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Template</DialogTitle>
            <DialogDescription>
              Create a new agent template for your clients.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                placeholder="e.g. Customer Support"
                value={newTemplate.name}
                onChange={(e) =>
                  setNewTemplate({ ...newTemplate, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">Description</Label>
              <Textarea
                id="tpl-desc"
                placeholder="Describe what this template does..."
                value={newTemplate.description}
                onChange={(e) =>
                  setNewTemplate({
                    ...newTemplate,
                    description: e.target.value,
                  })
                }
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Text Provider</Label>
                <Select
                  value={newTemplate.text_provider}
                  onValueChange={(val) =>
                    setNewTemplate({ ...newTemplate, text_provider: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Voice Provider</Label>
                <Select
                  value={newTemplate.voice_provider}
                  onValueChange={(val) =>
                    setNewTemplate({ ...newTemplate, voice_provider: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retell">Voice AI</SelectItem>
                    <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-retell-id">Voice Agent ID (optional)</Label>
              <Input
                id="tpl-retell-id"
                placeholder="agent_xxxxxxxxxxxx"
                value={newTemplate.retell_agent_id}
                onChange={(e) =>
                  setNewTemplate({
                    ...newTemplate,
                    retell_agent_id: e.target.value,
                  })
                }
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
              onClick={handleCreateTemplate}
              disabled={!newTemplate.name.trim() || creating}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Add Template"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
