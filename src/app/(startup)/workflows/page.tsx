"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Webhook, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Workflow {
  id: string;
  name: string;
  webhookUrl: string;
  description: string | null;
  active: boolean;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) return;

      // Get the current user's organization_id
      const { data: currentUser, error: userError } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (userError || !currentUser?.organization_id) return;

      setOrgId(currentUser.organization_id);

      // Fetch solutions (workflows) for this organization
      const { data: solutions, error: solutionsError } = await supabase
        .from("solutions")
        .select("id, name, description, webhook_url, is_active, created_at")
        .eq("organization_id", currentUser.organization_id)
        .order("created_at", { ascending: false });

      if (solutionsError || !solutions) return;

      const mapped: Workflow[] = solutions.map((s) => ({
        id: s.id,
        name: s.name || "Untitled Workflow",
        webhookUrl: s.webhook_url || "",
        description: s.description,
        active: s.is_active ?? false,
      }));

      setWorkflows(mapped);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleToggle = useCallback(
    async (id: string) => {
      const workflow = workflows.find((wf) => wf.id === id);
      if (!workflow) return;

      const newActive = !workflow.active;

      // Optimistic update
      setWorkflows((prev) =>
        prev.map((wf) => (wf.id === id ? { ...wf, active: newActive } : wf))
      );

      const supabase = createClient();
      const { error } = await supabase
        .from("solutions")
        .update({ is_active: newActive })
        .eq("id", id);

      if (error) {
        // Revert on failure
        setWorkflows((prev) =>
          prev.map((wf) =>
            wf.id === id ? { ...wf, active: !newActive } : wf
          )
        );
        toast.error("Failed to update workflow status.");
      }
    },
    [workflows]
  );

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newWebhookUrl.trim() || !orgId) return;

    setCreating(true);
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("solutions")
        .insert({
          name: newName.trim(),
          webhook_url: newWebhookUrl.trim(),
          organization_id: orgId,
          is_active: true,
        })
        .select("id, name, description, webhook_url, is_active, created_at")
        .single();

      if (error || !data) {
        if (error) toast.error("Failed to create workflow.");
        return;
      }

      toast.success("Workflow created.");

      const newWorkflow: Workflow = {
        id: data.id,
        name: data.name || "Untitled Workflow",
        webhookUrl: data.webhook_url || "",
        description: data.description,
        active: data.is_active ?? false,
      };

      setWorkflows((prev) => [newWorkflow, ...prev]);
      setNewName("");
      setNewWebhookUrl("");
      setDialogOpen(false);
    } finally {
      setCreating(false);
    }
  }, [newName, newWebhookUrl, orgId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-[#111827]">Workflows</h1>
              <Badge className="bg-orange-100 text-orange-700 border border-orange-300">
                Not HIPAA Compliant
              </Badge>
            </div>
            <p className="text-sm text-[#6b7280] mt-1">
              Manage your n8n webhook connections and workflow automations.
            </p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Workflow
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Workflow</DialogTitle>
              <DialogDescription>
                Create a new n8n webhook workflow for your organization.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="workflow-name">Name</Label>
                <Input
                  id="workflow-name"
                  placeholder="e.g. New Lead Notification"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  placeholder="https://n8n.invaria.io/webhook/..."
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                onClick={handleCreate}
                disabled={creating || !newName.trim() || !newWebhookUrl.trim()}
              >
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Workflow
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Workflows List */}
      {workflows.length > 0 ? (
        <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-gray-50">
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Webhook URL
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Assigned To
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Active
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {workflows.map((wf) => (
                <tr key={wf.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Webhook className="h-4 w-4 text-[#6b7280]" />
                      <span className="text-sm font-medium text-[#111827]">
                        {wf.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-[#6b7280] font-mono">
                      {wf.webhookUrl}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#6b7280]">
                      {wf.description || "\u2014"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={wf.active}
                      onCheckedChange={() => handleToggle(wf.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-[#e5e7eb] border-dashed rounded-lg py-16 flex flex-col items-center justify-center">
          <div className="bg-gray-100 rounded-full p-3 mb-4">
            <Webhook className="h-6 w-6 text-[#6b7280]" />
          </div>
          <h3 className="text-sm font-medium text-[#111827] mb-1">
            No workflows configured
          </h3>
          <p className="text-sm text-[#6b7280] mb-4">
            Get started by adding your first n8n webhook workflow.
          </p>
          <Button
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Workflow
          </Button>
        </div>
      )}
    </div>
  );
}
