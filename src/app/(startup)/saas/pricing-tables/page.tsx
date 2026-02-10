"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Code, Trash2, LayoutGrid, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { PricingTable, ClientPlan } from "@/types/database";

const emptyForm = {
  name: "",
  plan_ids: [] as string[],
  default_view: "monthly",
  button_shape: "rounded",
  background_color: "#ffffff",
  button_color: "#2563eb",
  highlight_enabled: false,
  highlight_plan_id: "",
  highlight_label: "Most Popular",
  highlight_color: "#2563eb",
  badge_color: "#2563eb",
};

export default function SaaSPricingTablesPage() {
  const [pricingTables, setPricingTables] = useState<PricingTable[]>([]);
  const [plans, setPlans] = useState<ClientPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  // Delete
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
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

      // Fetch pricing tables and plans in parallel
      const [tablesRes, plansRes] = await Promise.all([
        supabase
          .from("pricing_tables")
          .select("*")
          .eq("organization_id", dbUser.organization_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("client_plans")
          .select("*")
          .eq("organization_id", dbUser.organization_id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      if (tablesRes.error) throw tablesRes.error;
      if (plansRes.error) throw plansRes.error;

      setPricingTables((tablesRes.data as PricingTable[]) || []);
      setPlans((plansRes.data as ClientPlan[]) || []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load pricing tables"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateTable = async () => {
    if (!orgId || !formData.name.trim()) return;
    setCreating(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("pricing_tables").insert({
        organization_id: orgId,
        name: formData.name.trim(),
        plan_ids: formData.plan_ids,
        default_view: formData.default_view,
        button_shape: formData.button_shape,
        background_color: formData.background_color || null,
        button_color: formData.button_color,
        highlight_enabled: formData.highlight_enabled,
        highlight_plan_id: formData.highlight_plan_id || null,
        highlight_label: formData.highlight_label,
        highlight_color: formData.highlight_color,
        badge_color: formData.badge_color,
        is_active: true,
      });

      if (error) throw error;

      toast.success("Pricing table created successfully");
      setDialogOpen(false);
      setFormData(emptyForm);
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create pricing table"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTable = async (id: string) => {
    setDeleting(id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("pricing_tables")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Pricing table deleted");
      setPricingTables((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete pricing table"
      );
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (table: PricingTable) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("pricing_tables")
        .update({ is_active: !table.is_active })
        .eq("id", table.id);

      if (error) throw error;

      setPricingTables((prev) =>
        prev.map((t) =>
          t.id === table.id ? { ...t, is_active: !t.is_active } : t
        )
      );
      toast.success(
        `Pricing table ${!table.is_active ? "activated" : "deactivated"}`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update status"
      );
    }
  };

  function handleCopyEmbed(id: string) {
    const embedCode = `<script src="${window.location.origin}/pricing/embed/${id}.js"></script>`;
    navigator.clipboard.writeText(embedCode);
    setCopiedId(id);
    toast.success("Embed code copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }

  function togglePlanSelection(planId: string) {
    setFormData((prev) => {
      const exists = prev.plan_ids.includes(planId);
      return {
        ...prev,
        plan_ids: exists
          ? prev.plan_ids.filter((id) => id !== planId)
          : [...prev.plan_ids, planId],
      };
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6b7280]">
          Manage your subscription plan layouts and pricing displays.
        </p>
        <Button
          className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Table
        </Button>
      </div>

      {/* Pricing Tables List */}
      {pricingTables.length > 0 ? (
        <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-gray-50">
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Plans
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Default View
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Embed Code
                </th>
                <th className="text-right text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {pricingTables.map((table) => {
                const planCount = table.plan_ids?.length || 0;
                return (
                  <tr
                    key={table.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-[#111827]">
                        {table.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6b7280]">
                      {planCount} plan{planCount !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6b7280] capitalize">
                      {table.default_view}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={
                            table.is_active
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-gray-100 text-[#6b7280] border border-[#e5e7eb]"
                          }
                        >
                          {table.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Switch
                          checked={table.is_active}
                          onCheckedChange={() => handleToggleActive(table)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleCopyEmbed(table.id)}
                      >
                        <Code className="h-3 w-3 mr-1.5" />
                        {copiedId === table.id ? "Copied!" : "Copy Embed"}
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleDeleteTable(table.id)}
                          disabled={deleting === table.id}
                        >
                          {deleting === table.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-[#e5e7eb] border-dashed rounded-lg py-16 flex flex-col items-center justify-center">
          <div className="bg-gray-100 rounded-full p-3 mb-4">
            <LayoutGrid className="h-6 w-6 text-[#6b7280]" />
          </div>
          <h3 className="text-sm font-medium text-[#111827] mb-1">
            No pricing tables yet
          </h3>
          <p className="text-sm text-[#6b7280] mb-4">
            Create a pricing table to display your plans on your website.
          </p>
          <Button
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Table
          </Button>
        </div>
      )}

      {/* Create Pricing Table Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Pricing Table</DialogTitle>
            <DialogDescription>
              Configure a new pricing table to embed on your website.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Table Name</Label>
              <Input
                placeholder="e.g. Main Pricing Page"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            {/* Plan Multi-Select */}
            <div className="space-y-2">
              <Label>Select Plans</Label>
              {plans.length > 0 ? (
                <div className="border border-[#e5e7eb] rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-center gap-2"
                    >
                      <Checkbox
                        id={`plan-${plan.id}`}
                        checked={formData.plan_ids.includes(plan.id)}
                        onCheckedChange={() => togglePlanSelection(plan.id)}
                      />
                      <label
                        htmlFor={`plan-${plan.id}`}
                        className="text-sm text-[#111827] cursor-pointer"
                      >
                        {plan.name}{" "}
                        <span className="text-[#6b7280]">
                          (${plan.monthly_price}/mo)
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#6b7280]">
                  No active plans available. Create plans first.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default View</Label>
                <Select
                  value={formData.default_view}
                  onValueChange={(val) =>
                    setFormData({ ...formData, default_view: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Button Shape</Label>
                <Select
                  value={formData.button_shape}
                  onValueChange={(val) =>
                    setFormData({ ...formData, button_shape: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rounded">Rounded</SelectItem>
                    <SelectItem value="pill">Pill</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Background Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.background_color}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        background_color: e.target.value,
                      })
                    }
                    className="w-8 h-8 rounded border border-[#e5e7eb] cursor-pointer"
                  />
                  <Input
                    value={formData.background_color}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        background_color: e.target.value,
                      })
                    }
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Button Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.button_color}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        button_color: e.target.value,
                      })
                    }
                    className="w-8 h-8 rounded border border-[#e5e7eb] cursor-pointer"
                  />
                  <Input
                    value={formData.button_color}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        button_color: e.target.value,
                      })
                    }
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Highlight Settings */}
            <div className="space-y-3 border-t border-[#e5e7eb] pt-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.highlight_enabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, highlight_enabled: checked })
                  }
                />
                <Label>Highlight a plan</Label>
              </div>
              {formData.highlight_enabled && (
                <div className="space-y-3 pl-2">
                  <div className="space-y-2">
                    <Label>Highlighted Plan</Label>
                    <Select
                      value={formData.highlight_plan_id}
                      onValueChange={(val) =>
                        setFormData({ ...formData, highlight_plan_id: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select plan to highlight" />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.plan_ids.map((pid) => {
                          const p = plans.find((pl) => pl.id === pid);
                          return p ? (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ) : null;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Highlight Label</Label>
                    <Input
                      value={formData.highlight_label}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          highlight_label: e.target.value,
                        })
                      }
                      placeholder="Most Popular"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Highlight Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.highlight_color}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              highlight_color: e.target.value,
                            })
                          }
                          className="w-8 h-8 rounded border border-[#e5e7eb] cursor-pointer"
                        />
                        <Input
                          value={formData.highlight_color}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              highlight_color: e.target.value,
                            })
                          }
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Badge Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.badge_color}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              badge_color: e.target.value,
                            })
                          }
                          className="w-8 h-8 rounded border border-[#e5e7eb] cursor-pointer"
                        />
                        <Input
                          value={formData.badge_color}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              badge_color: e.target.value,
                            })
                          }
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              onClick={handleCreateTable}
              disabled={
                !formData.name.trim() ||
                formData.plan_ids.length === 0 ||
                creating
              }
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Table"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
