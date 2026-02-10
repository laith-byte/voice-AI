"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Copy, Pencil, Trash2, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import type { ClientPlan } from "@/types/database";

const emptyPlan = {
  name: "",
  description: "",
  monthly_price: "",
  yearly_price: "",
  setup_fee: "",
  agents_included: "",
  call_minutes_included: "",
  overage_rate: "",
  features: "",
};

export default function SaaSPlansPage() {
  const [plans, setPlans] = useState<ClientPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState(emptyPlan);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ClientPlan | null>(null);
  const [editFormData, setEditFormData] = useState(emptyPlan);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
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
        .from("client_plans")
        .select("*")
        .eq("organization_id", dbUser.organization_id)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setPlans((data as ClientPlan[]) || []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load plans"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleCreatePlan = async () => {
    if (!orgId || !formData.name.trim()) return;
    setCreating(true);
    try {
      const supabase = createClient();

      // Parse features from comma-separated string into array
      const featuresArr = formData.features
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      const { error } = await supabase.from("client_plans").insert({
        organization_id: orgId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        monthly_price: formData.monthly_price
          ? parseFloat(formData.monthly_price)
          : null,
        yearly_price: formData.yearly_price
          ? parseFloat(formData.yearly_price)
          : null,
        setup_fee: formData.setup_fee ? parseFloat(formData.setup_fee) : 0,
        agents_included: formData.agents_included
          ? parseInt(formData.agents_included)
          : 1,
        call_minutes_included: formData.call_minutes_included
          ? parseInt(formData.call_minutes_included)
          : 0,
        overage_rate: formData.overage_rate
          ? parseFloat(formData.overage_rate)
          : null,
        features: featuresArr.length > 0 ? featuresArr : null,
        sort_order: plans.length,
        is_active: true,
      });

      if (error) throw error;

      toast.success("Plan created successfully");
      setDialogOpen(false);
      setFormData(emptyPlan);
      fetchPlans();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create plan"
      );
    } finally {
      setCreating(false);
    }
  };

  const openEditDialog = (plan: ClientPlan) => {
    setEditingPlan(plan);
    const features = Array.isArray(plan.features)
      ? (plan.features as string[]).join(", ")
      : "";
    setEditFormData({
      name: plan.name,
      description: plan.description || "",
      monthly_price: plan.monthly_price?.toString() || "",
      yearly_price: plan.yearly_price?.toString() || "",
      setup_fee: plan.setup_fee?.toString() || "",
      agents_included: plan.agents_included?.toString() || "",
      call_minutes_included: plan.call_minutes_included?.toString() || "",
      overage_rate: plan.overage_rate?.toString() || "",
      features,
    });
    setEditDialogOpen(true);
  };

  const handleEditPlan = async () => {
    if (!editingPlan || !editFormData.name.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();

      const featuresArr = editFormData.features
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from("client_plans")
        .update({
          name: editFormData.name.trim(),
          description: editFormData.description.trim() || null,
          monthly_price: editFormData.monthly_price
            ? parseFloat(editFormData.monthly_price)
            : null,
          yearly_price: editFormData.yearly_price
            ? parseFloat(editFormData.yearly_price)
            : null,
          setup_fee: editFormData.setup_fee
            ? parseFloat(editFormData.setup_fee)
            : 0,
          agents_included: editFormData.agents_included
            ? parseInt(editFormData.agents_included)
            : 1,
          call_minutes_included: editFormData.call_minutes_included
            ? parseInt(editFormData.call_minutes_included)
            : 0,
          overage_rate: editFormData.overage_rate
            ? parseFloat(editFormData.overage_rate)
            : null,
          features: featuresArr.length > 0 ? featuresArr : null,
        })
        .eq("id", editingPlan.id);

      if (error) throw error;

      toast.success("Plan updated successfully");
      setEditDialogOpen(false);
      setEditingPlan(null);
      fetchPlans();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update plan"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    setDeleting(id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("client_plans")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Plan deleted");
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete plan"
      );
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (plan: ClientPlan) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("client_plans")
        .update({ is_active: !plan.is_active })
        .eq("id", plan.id);

      if (error) throw error;

      setPlans((prev) =>
        prev.map((p) =>
          p.id === plan.id ? { ...p, is_active: !p.is_active } : p
        )
      );
      toast.success(
        `Plan ${!plan.is_active ? "activated" : "deactivated"}`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update plan status"
      );
    }
  };

  const handleDuplicate = async (plan: ClientPlan) => {
    if (!orgId) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("client_plans").insert({
        organization_id: orgId,
        name: `${plan.name} (Copy)`,
        description: plan.description,
        monthly_price: plan.monthly_price,
        yearly_price: plan.yearly_price,
        setup_fee: plan.setup_fee,
        agents_included: plan.agents_included,
        call_minutes_included: plan.call_minutes_included,
        overage_rate: plan.overage_rate,
        features: plan.features,
        sort_order: plans.length,
        is_active: false,
      });

      if (error) throw error;

      toast.success("Plan duplicated");
      fetchPlans();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to duplicate plan"
      );
    }
  };

  function formatPrice(amount: number | null) {
    if (amount === null || amount === undefined) return "$0";
    return `$${amount.toLocaleString()}`;
  }

  // Shared form fields renderer
  function renderPlanFormFields(
    data: typeof emptyPlan,
    setData: React.Dispatch<React.SetStateAction<typeof emptyPlan>>
  ) {
    return (
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label>Plan Name</Label>
          <Input
            placeholder="e.g. Starter"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            placeholder="Describe this plan..."
            value={data.description}
            onChange={(e) =>
              setData({ ...data, description: e.target.value })
            }
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Monthly Price ($)</Label>
            <Input
              type="number"
              placeholder="49"
              value={data.monthly_price}
              onChange={(e) =>
                setData({ ...data, monthly_price: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Yearly Price ($)</Label>
            <Input
              type="number"
              placeholder="470"
              value={data.yearly_price}
              onChange={(e) =>
                setData({ ...data, yearly_price: e.target.value })
              }
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Setup Fee ($)</Label>
            <Input
              type="number"
              placeholder="0"
              value={data.setup_fee}
              onChange={(e) =>
                setData({ ...data, setup_fee: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Agents Included</Label>
            <Input
              type="number"
              placeholder="1"
              value={data.agents_included}
              onChange={(e) =>
                setData({ ...data, agents_included: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Minutes Included</Label>
            <Input
              type="number"
              placeholder="500"
              value={data.call_minutes_included}
              onChange={(e) =>
                setData({
                  ...data,
                  call_minutes_included: e.target.value,
                })
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Overage Rate ($/min)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.05"
            value={data.overage_rate}
            onChange={(e) =>
              setData({ ...data, overage_rate: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Features (comma-separated)</Label>
          <Textarea
            placeholder="1 Voice Agent, 500 minutes/mo, Basic Analytics"
            value={data.features}
            onChange={(e) =>
              setData({ ...data, features: e.target.value })
            }
            rows={2}
          />
        </div>
      </div>
    );
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
          Configure plans that your clients can subscribe to.
        </p>
        <Button
          className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const features = Array.isArray(plan.features)
            ? (plan.features as string[])
            : [];

          return (
            <Card
              key={plan.id}
              className={`relative ${!plan.is_active ? "opacity-60" : ""}`}
            >
              <CardContent className="p-5">
                {/* Plan Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-[#111827]">
                        {plan.name}
                      </h3>
                      <Switch
                        checked={plan.is_active}
                        onCheckedChange={() => handleToggleActive(plan)}
                      />
                    </div>
                    <p className="text-xs text-[#6b7280] mt-1">
                      {plan.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleDuplicate(plan)}
                    >
                      <Copy className="h-3.5 w-3.5 text-[#6b7280]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => openEditDialog(plan)}
                    >
                      <Pencil className="h-3.5 w-3.5 text-[#6b7280]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleDeletePlan(plan.id)}
                      disabled={deleting === plan.id}
                    >
                      {deleting === plan.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Pricing */}
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-2xl font-bold text-[#111827]">
                    {formatPrice(plan.monthly_price)}
                  </span>
                  <span className="text-sm text-[#6b7280]">/month</span>
                </div>
                <p className="text-xs text-[#6b7280] mb-4">
                  or {formatPrice(plan.yearly_price)}/year
                  {plan.setup_fee > 0 &&
                    ` + ${formatPrice(plan.setup_fee)} setup`}
                </p>

                {/* Agents */}
                <div className="mb-4">
                  <Badge
                    variant="secondary"
                    className="bg-blue-50 text-[#2563eb] border border-blue-200"
                  >
                    {plan.agents_included} agent
                    {plan.agents_included !== 1 ? "s" : ""} included
                  </Badge>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-4">
                  {features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <span className="text-xs text-[#6b7280]">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Usage Limits */}
                <div className="pt-3 border-t border-[#e5e7eb]">
                  <p className="text-xs text-[#6b7280]">
                    <span className="font-medium text-[#111827]">
                      Usage limit:
                    </span>{" "}
                    {plan.call_minutes_included.toLocaleString()} minutes/month
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Plan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Plan</DialogTitle>
            <DialogDescription>
              Add a new subscription plan for your clients.
            </DialogDescription>
          </DialogHeader>
          {renderPlanFormFields(formData, setFormData)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              onClick={handleCreatePlan}
              disabled={!formData.name.trim() || creating}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Plan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Plan</DialogTitle>
            <DialogDescription>
              Update the plan details.
            </DialogDescription>
          </DialogHeader>
          {renderPlanFormFields(editFormData, setEditFormData)}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              onClick={handleEditPlan}
              disabled={!editFormData.name.trim() || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
