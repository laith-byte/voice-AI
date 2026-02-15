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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { ClientPlan } from "@/types/database";

interface PlanFormData {
  // Identity
  name: string;
  slug: string;
  tagline: string;
  description: string;
  badge: string;
  // Pricing
  monthly_price: string;
  yearly_price: string;
  setup_fee: string;
  is_custom_pricing: boolean;
  stripe_monthly_price_id: string;
  stripe_yearly_price_id: string;
  stripe_setup_price_id: string;
  // Usage
  agents_included: string;
  phone_numbers_included: string;
  call_minutes_included: string;
  overage_rate: string;
  concurrent_calls: string;
  knowledge_bases: string;
  // Analytics features
  analytics_full: boolean;
  ai_evaluation: boolean;
  ai_auto_tagging: boolean;
  ai_misunderstood: boolean;
  topic_management: boolean;
  daily_digest: boolean;
  analytics_export: boolean;
  custom_reporting: boolean;
  // Automation features
  sms_notification: boolean;
  caller_followup_email: boolean;
  max_recipes: string;
  google_calendar: boolean;
  slack_integration: boolean;
  crm_integration: boolean;
  webhook_forwarding: boolean;
  api_access: boolean;
  // Agent config features
  voice_selection: string;
  llm_selection: string;
  raw_prompt_editor: boolean;
  functions_tools: boolean;
  pronunciation_dict: boolean;
  post_call_analysis_config: boolean;
  campaign_outbound: boolean;
  mcp_configuration: boolean;
  speech_settings_full: boolean;
  // Support features
  priority_support: boolean;
  dedicated_account_manager: boolean;
  onboarding_call: boolean;
  custom_agent_buildout: boolean;
  sla_guarantee: boolean;
  hipaa_compliance: boolean;
  custom_branding: boolean;
  // Display
  sort_order: string;
  is_active: boolean;
  is_highlighted: boolean;
  features: string;
}

const emptyPlan: PlanFormData = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  badge: "",
  monthly_price: "",
  yearly_price: "",
  setup_fee: "",
  is_custom_pricing: false,
  stripe_monthly_price_id: "",
  stripe_yearly_price_id: "",
  stripe_setup_price_id: "",
  agents_included: "1",
  phone_numbers_included: "1",
  call_minutes_included: "",
  overage_rate: "",
  concurrent_calls: "5",
  knowledge_bases: "1",
  analytics_full: false,
  ai_evaluation: false,
  ai_auto_tagging: false,
  ai_misunderstood: false,
  topic_management: false,
  daily_digest: false,
  analytics_export: false,
  custom_reporting: false,
  sms_notification: false,
  caller_followup_email: false,
  max_recipes: "3",
  google_calendar: false,
  slack_integration: false,
  crm_integration: false,
  webhook_forwarding: false,
  api_access: false,
  voice_selection: "default",
  llm_selection: "default",
  raw_prompt_editor: false,
  functions_tools: false,
  pronunciation_dict: false,
  post_call_analysis_config: false,
  campaign_outbound: false,
  mcp_configuration: false,
  speech_settings_full: false,
  priority_support: false,
  dedicated_account_manager: false,
  onboarding_call: false,
  custom_agent_buildout: false,
  sla_guarantee: false,
  hipaa_compliance: false,
  custom_branding: false,
  sort_order: "0",
  is_active: true,
  is_highlighted: false,
  features: "",
};

function planToFormData(plan: ClientPlan): PlanFormData {
  const features = Array.isArray(plan.features)
    ? (plan.features as string[]).join(", ")
    : "";
  return {
    name: plan.name,
    slug: plan.slug || "",
    tagline: plan.tagline || "",
    description: plan.description || "",
    badge: plan.badge || "",
    monthly_price: plan.monthly_price?.toString() || "",
    yearly_price: plan.yearly_price?.toString() || "",
    setup_fee: plan.setup_fee?.toString() || "",
    is_custom_pricing: plan.is_custom_pricing ?? false,
    stripe_monthly_price_id: plan.stripe_monthly_price_id || "",
    stripe_yearly_price_id: plan.stripe_yearly_price_id || "",
    stripe_setup_price_id: plan.stripe_setup_price_id || "",
    agents_included: plan.agents_included?.toString() || "1",
    phone_numbers_included: plan.phone_numbers_included?.toString() || "1",
    call_minutes_included: plan.call_minutes_included?.toString() || "",
    overage_rate: plan.overage_rate?.toString() || "",
    concurrent_calls: (plan.concurrent_calls ?? 5).toString(),
    knowledge_bases: (plan.knowledge_bases ?? 1).toString(),
    analytics_full: plan.analytics_full ?? false,
    ai_evaluation: plan.ai_evaluation ?? false,
    ai_auto_tagging: plan.ai_auto_tagging ?? false,
    ai_misunderstood: plan.ai_misunderstood ?? false,
    topic_management: plan.topic_management ?? false,
    daily_digest: plan.daily_digest ?? false,
    analytics_export: plan.analytics_export ?? false,
    custom_reporting: plan.custom_reporting ?? false,
    sms_notification: plan.sms_notification ?? false,
    caller_followup_email: plan.caller_followup_email ?? false,
    max_recipes: plan.max_recipes?.toString() || "",
    google_calendar: plan.google_calendar ?? false,
    slack_integration: plan.slack_integration ?? false,
    crm_integration: plan.crm_integration ?? false,
    webhook_forwarding: plan.webhook_forwarding ?? false,
    api_access: plan.api_access ?? false,
    voice_selection: plan.voice_selection || "default",
    llm_selection: plan.llm_selection || "default",
    raw_prompt_editor: plan.raw_prompt_editor ?? false,
    functions_tools: plan.functions_tools ?? false,
    pronunciation_dict: plan.pronunciation_dict ?? false,
    post_call_analysis_config: plan.post_call_analysis_config ?? false,
    campaign_outbound: plan.campaign_outbound ?? false,
    mcp_configuration: plan.mcp_configuration ?? false,
    speech_settings_full: plan.speech_settings_full ?? false,
    priority_support: plan.priority_support ?? false,
    dedicated_account_manager: plan.dedicated_account_manager ?? false,
    onboarding_call: plan.onboarding_call ?? false,
    custom_agent_buildout: plan.custom_agent_buildout ?? false,
    sla_guarantee: plan.sla_guarantee ?? false,
    hipaa_compliance: plan.hipaa_compliance ?? false,
    custom_branding: plan.custom_branding ?? false,
    sort_order: plan.sort_order?.toString() || "0",
    is_active: plan.is_active ?? true,
    is_highlighted: plan.is_highlighted ?? false,
    features,
  };
}

function formDataToDbPayload(data: PlanFormData, orgId: string) {
  const featuresArr = data.features
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  return {
    organization_id: orgId,
    name: data.name.trim(),
    slug: data.slug.trim() || null,
    tagline: data.tagline.trim() || null,
    description: data.description.trim() || null,
    badge: data.badge.trim() || null,
    monthly_price: data.monthly_price ? parseFloat(data.monthly_price) : null,
    yearly_price: data.yearly_price ? parseFloat(data.yearly_price) : null,
    setup_fee: data.setup_fee ? parseFloat(data.setup_fee) : 0,
    is_custom_pricing: data.is_custom_pricing,
    stripe_monthly_price_id: data.stripe_monthly_price_id.trim() || null,
    stripe_yearly_price_id: data.stripe_yearly_price_id.trim() || null,
    stripe_setup_price_id: data.stripe_setup_price_id.trim() || null,
    agents_included: data.agents_included ? parseInt(data.agents_included) : 1,
    phone_numbers_included: data.phone_numbers_included ? parseInt(data.phone_numbers_included) : 1,
    call_minutes_included: data.call_minutes_included ? parseInt(data.call_minutes_included) : 0,
    overage_rate: data.overage_rate ? parseFloat(data.overage_rate) : null,
    concurrent_calls: data.concurrent_calls ? parseInt(data.concurrent_calls) : 5,
    knowledge_bases: data.knowledge_bases ? parseInt(data.knowledge_bases) : 1,
    analytics_full: data.analytics_full,
    ai_evaluation: data.ai_evaluation,
    ai_auto_tagging: data.ai_auto_tagging,
    ai_misunderstood: data.ai_misunderstood,
    topic_management: data.topic_management,
    daily_digest: data.daily_digest,
    analytics_export: data.analytics_export,
    custom_reporting: data.custom_reporting,
    sms_notification: data.sms_notification,
    caller_followup_email: data.caller_followup_email,
    max_recipes: data.max_recipes ? parseInt(data.max_recipes) : null,
    google_calendar: data.google_calendar,
    slack_integration: data.slack_integration,
    crm_integration: data.crm_integration,
    webhook_forwarding: data.webhook_forwarding,
    api_access: data.api_access,
    voice_selection: data.voice_selection,
    llm_selection: data.llm_selection,
    raw_prompt_editor: data.raw_prompt_editor,
    functions_tools: data.functions_tools,
    pronunciation_dict: data.pronunciation_dict,
    post_call_analysis_config: data.post_call_analysis_config,
    campaign_outbound: data.campaign_outbound,
    mcp_configuration: data.mcp_configuration,
    speech_settings_full: data.speech_settings_full,
    priority_support: data.priority_support,
    dedicated_account_manager: data.dedicated_account_manager,
    onboarding_call: data.onboarding_call,
    custom_agent_buildout: data.custom_agent_buildout,
    sla_guarantee: data.sla_guarantee,
    hipaa_compliance: data.hipaa_compliance,
    custom_branding: data.custom_branding,
    sort_order: data.sort_order ? parseInt(data.sort_order) : 0,
    is_active: data.is_active,
    is_highlighted: data.is_highlighted,
    features: featuresArr.length > 0 ? featuresArr : null,
  };
}

function FeatureToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function SaaSPlansPage() {
  const [plans, setPlans] = useState<ClientPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<PlanFormData>({ ...emptyPlan });

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ClientPlan | null>(null);
  const [editFormData, setEditFormData] = useState<PlanFormData>({ ...emptyPlan });
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
      const payload = formDataToDbPayload(formData, orgId);
      payload.sort_order = plans.length;

      const { error } = await supabase.from("client_plans").insert(payload);
      if (error) throw error;

      toast.success("Plan created successfully");
      setDialogOpen(false);
      setFormData({ ...emptyPlan });
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
    setEditFormData(planToFormData(plan));
    setEditDialogOpen(true);
  };

  const handleEditPlan = async () => {
    if (!editingPlan || !orgId || !editFormData.name.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = formDataToDbPayload(editFormData, orgId);
      // Remove organization_id from update payload
      const { organization_id, ...updatePayload } = payload;

      const { error } = await supabase
        .from("client_plans")
        .update(updatePayload)
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
      const formCopy = planToFormData(plan);
      formCopy.name = `${plan.name} (Copy)`;
      formCopy.is_active = false;
      const payload = formDataToDbPayload(formCopy, orgId);
      payload.sort_order = plans.length;

      const { error } = await supabase.from("client_plans").insert(payload);
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

  // Shared form fields renderer with tabs
  function renderPlanFormFields(
    data: PlanFormData,
    setData: React.Dispatch<React.SetStateAction<PlanFormData>>
  ) {
    return (
      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Plan Name</Label>
            <Input
              placeholder="e.g. Starter"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                placeholder="e.g. starter"
                value={data.slug}
                onChange={(e) => setData({ ...data, slug: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Badge</Label>
              <Input
                placeholder="e.g. Most Popular"
                value={data.badge}
                onChange={(e) => setData({ ...data, badge: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tagline</Label>
            <Input
              placeholder="e.g. Perfect for small businesses"
              value={data.tagline}
              onChange={(e) => setData({ ...data, tagline: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe this plan..."
              value={data.description}
              onChange={(e) => setData({ ...data, description: e.target.value })}
              rows={2}
            />
          </div>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <Label>Custom Pricing (Contact Sales)</Label>
            <Switch
              checked={data.is_custom_pricing}
              onCheckedChange={(v) => setData({ ...data, is_custom_pricing: v })}
            />
          </div>
          {!data.is_custom_pricing && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monthly Price ($)</Label>
                  <Input
                    type="number"
                    placeholder="499"
                    value={data.monthly_price}
                    onChange={(e) => setData({ ...data, monthly_price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Yearly Price ($)</Label>
                  <Input
                    type="number"
                    placeholder="4790"
                    value={data.yearly_price}
                    onChange={(e) => setData({ ...data, yearly_price: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Setup Fee ($)</Label>
                <Input
                  type="number"
                  placeholder="249"
                  value={data.setup_fee}
                  onChange={(e) => setData({ ...data, setup_fee: e.target.value })}
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Stripe Monthly Price ID</Label>
            <Input
              placeholder="price_..."
              value={data.stripe_monthly_price_id}
              onChange={(e) => setData({ ...data, stripe_monthly_price_id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Stripe Yearly Price ID</Label>
            <Input
              placeholder="price_..."
              value={data.stripe_yearly_price_id}
              onChange={(e) => setData({ ...data, stripe_yearly_price_id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Stripe Setup Price ID</Label>
            <Input
              placeholder="price_..."
              value={data.stripe_setup_price_id}
              onChange={(e) => setData({ ...data, stripe_setup_price_id: e.target.value })}
            />
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Agents Included</Label>
              <Input
                type="number"
                placeholder="1"
                value={data.agents_included}
                onChange={(e) => setData({ ...data, agents_included: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Numbers</Label>
              <Input
                type="number"
                placeholder="1"
                value={data.phone_numbers_included}
                onChange={(e) => setData({ ...data, phone_numbers_included: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Minutes/mo</Label>
              <Input
                type="number"
                placeholder="500"
                value={data.call_minutes_included}
                onChange={(e) => setData({ ...data, call_minutes_included: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Overage ($/min)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.12"
                value={data.overage_rate}
                onChange={(e) => setData({ ...data, overage_rate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Concurrent Calls</Label>
              <Input
                type="number"
                placeholder="5"
                value={data.concurrent_calls}
                onChange={(e) => setData({ ...data, concurrent_calls: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Knowledge Bases</Label>
              <Input
                type="number"
                placeholder="1"
                value={data.knowledge_bases}
                onChange={(e) => setData({ ...data, knowledge_bases: e.target.value })}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4 py-2 max-h-[400px] overflow-y-auto">
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Analytics</h4>
            <div className="space-y-1 border rounded-lg p-3">
              <FeatureToggle label="Full Analytics" checked={data.analytics_full} onChange={(v) => setData({ ...data, analytics_full: v })} />
              <FeatureToggle label="AI Evaluation" checked={data.ai_evaluation} onChange={(v) => setData({ ...data, ai_evaluation: v })} />
              <FeatureToggle label="AI Auto-Tagging" checked={data.ai_auto_tagging} onChange={(v) => setData({ ...data, ai_auto_tagging: v })} />
              <FeatureToggle label="Misunderstood Detection" checked={data.ai_misunderstood} onChange={(v) => setData({ ...data, ai_misunderstood: v })} />
              <FeatureToggle label="Topic Management" checked={data.topic_management} onChange={(v) => setData({ ...data, topic_management: v })} />
              <FeatureToggle label="Daily Digest" checked={data.daily_digest} onChange={(v) => setData({ ...data, daily_digest: v })} />
              <FeatureToggle label="Analytics Export" checked={data.analytics_export} onChange={(v) => setData({ ...data, analytics_export: v })} />
              <FeatureToggle label="Custom Reporting" checked={data.custom_reporting} onChange={(v) => setData({ ...data, custom_reporting: v })} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Automations</h4>
            <div className="space-y-1 border rounded-lg p-3">
              <FeatureToggle label="SMS Notification" checked={data.sms_notification} onChange={(v) => setData({ ...data, sms_notification: v })} />
              <FeatureToggle label="Caller Follow-up Email" checked={data.caller_followup_email} onChange={(v) => setData({ ...data, caller_followup_email: v })} />
              <div className="flex items-center justify-between py-1.5">
                <Label className="text-sm">Max Recipes</Label>
                <Input
                  type="number"
                  className="w-20 h-8"
                  placeholder="∞"
                  value={data.max_recipes}
                  onChange={(e) => setData({ ...data, max_recipes: e.target.value })}
                />
              </div>
              <FeatureToggle label="Google Calendar" checked={data.google_calendar} onChange={(v) => setData({ ...data, google_calendar: v })} />
              <FeatureToggle label="Slack Integration" checked={data.slack_integration} onChange={(v) => setData({ ...data, slack_integration: v })} />
              <FeatureToggle label="CRM Integration" checked={data.crm_integration} onChange={(v) => setData({ ...data, crm_integration: v })} />
              <FeatureToggle label="Webhook Forwarding" checked={data.webhook_forwarding} onChange={(v) => setData({ ...data, webhook_forwarding: v })} />
              <FeatureToggle label="API Access" checked={data.api_access} onChange={(v) => setData({ ...data, api_access: v })} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Agent Config</h4>
            <div className="space-y-1 border rounded-lg p-3">
              <div className="flex items-center justify-between py-1.5">
                <Label className="text-sm">Voice Selection</Label>
                <Select value={data.voice_selection} onValueChange={(v) => setData({ ...data, voice_selection: v })}>
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <Label className="text-sm">LLM Selection</Label>
                <Select value={data.llm_selection} onValueChange={(v) => setData({ ...data, llm_selection: v })}>
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FeatureToggle label="Raw Prompt Editor" checked={data.raw_prompt_editor} onChange={(v) => setData({ ...data, raw_prompt_editor: v })} />
              <FeatureToggle label="Functions & Tools" checked={data.functions_tools} onChange={(v) => setData({ ...data, functions_tools: v })} />
              <FeatureToggle label="Pronunciation Dict" checked={data.pronunciation_dict} onChange={(v) => setData({ ...data, pronunciation_dict: v })} />
              <FeatureToggle label="Post-Call Analysis Config" checked={data.post_call_analysis_config} onChange={(v) => setData({ ...data, post_call_analysis_config: v })} />
              <FeatureToggle label="Campaign Outbound" checked={data.campaign_outbound} onChange={(v) => setData({ ...data, campaign_outbound: v })} />
              <FeatureToggle label="MCP Configuration" checked={data.mcp_configuration} onChange={(v) => setData({ ...data, mcp_configuration: v })} />
              <FeatureToggle label="Full Speech Settings" checked={data.speech_settings_full} onChange={(v) => setData({ ...data, speech_settings_full: v })} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Support</h4>
            <div className="space-y-1 border rounded-lg p-3">
              <FeatureToggle label="Priority Support" checked={data.priority_support} onChange={(v) => setData({ ...data, priority_support: v })} />
              <FeatureToggle label="Dedicated Account Manager" checked={data.dedicated_account_manager} onChange={(v) => setData({ ...data, dedicated_account_manager: v })} />
              <FeatureToggle label="Onboarding Call" checked={data.onboarding_call} onChange={(v) => setData({ ...data, onboarding_call: v })} />
              <FeatureToggle label="Custom Agent Buildout" checked={data.custom_agent_buildout} onChange={(v) => setData({ ...data, custom_agent_buildout: v })} />
              <FeatureToggle label="SLA Guarantee" checked={data.sla_guarantee} onChange={(v) => setData({ ...data, sla_guarantee: v })} />
              <FeatureToggle label="HIPAA Compliance" checked={data.hipaa_compliance} onChange={(v) => setData({ ...data, hipaa_compliance: v })} />
              <FeatureToggle label="Custom Branding" checked={data.custom_branding} onChange={(v) => setData({ ...data, custom_branding: v })} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="display" className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                placeholder="0"
                value={data.sort_order}
                onChange={(e) => setData({ ...data, sort_order: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch
              checked={data.is_active}
              onCheckedChange={(v) => setData({ ...data, is_active: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Highlighted (Popular)</Label>
            <Switch
              checked={data.is_highlighted}
              onCheckedChange={(v) => setData({ ...data, is_highlighted: v })}
            />
          </div>
          <div className="space-y-2">
            <Label>Features List (comma-separated, for display)</Label>
            <Textarea
              placeholder="1 Voice Agent, 500 minutes/mo, Basic Analytics"
              value={data.features}
              onChange={(e) => setData({ ...data, features: e.target.value })}
              rows={3}
            />
          </div>
        </TabsContent>
      </Tabs>
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
              className={`relative ${!plan.is_active ? "opacity-60" : ""} ${plan.is_highlighted ? "border-blue-500 border-2" : ""}`}
            >
              <CardContent className="p-5">
                {/* Plan Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-[#111827]">
                        {plan.name}
                      </h3>
                      {plan.badge && (
                        <Badge variant="secondary" className="text-[10px]">{plan.badge}</Badge>
                      )}
                      <Switch
                        checked={plan.is_active}
                        onCheckedChange={() => handleToggleActive(plan)}
                      />
                    </div>
                    {plan.slug && (
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">/{plan.slug}</p>
                    )}
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
                  {plan.is_custom_pricing ? (
                    <span className="text-xl font-bold text-[#111827]">Custom</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-[#111827]">
                        {formatPrice(plan.monthly_price)}
                      </span>
                      <span className="text-sm text-[#6b7280]">/month</span>
                    </>
                  )}
                </div>
                {!plan.is_custom_pricing && (
                  <p className="text-xs text-[#6b7280] mb-4">
                    or {formatPrice(plan.yearly_price)}/year
                    {plan.setup_fee > 0 &&
                      ` + ${formatPrice(plan.setup_fee)} setup`}
                  </p>
                )}

                {/* Usage */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  <Badge variant="secondary" className="bg-blue-50 text-[#2563eb] border border-blue-200 text-[10px]">
                    {plan.agents_included} agent{plan.agents_included !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="secondary" className="bg-blue-50 text-[#2563eb] border border-blue-200 text-[10px]">
                    {plan.phone_numbers_included} number{plan.phone_numbers_included !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="secondary" className="bg-blue-50 text-[#2563eb] border border-blue-200 text-[10px]">
                    {plan.call_minutes_included.toLocaleString()} min/mo
                  </Badge>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-4">
                  {features.map((feature) => (
                    <div key={feature as string} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <span className="text-xs text-[#6b7280]">{feature as string}</span>
                    </div>
                  ))}
                </div>

                {/* Feature gates summary */}
                <div className="pt-3 border-t border-[#e5e7eb]">
                  <div className="flex flex-wrap gap-1">
                    {plan.analytics_full && <Badge variant="outline" className="text-[9px] h-5">Analytics</Badge>}
                    {plan.ai_evaluation && <Badge variant="outline" className="text-[9px] h-5">AI Eval</Badge>}
                    {plan.topic_management && <Badge variant="outline" className="text-[9px] h-5">Topics</Badge>}
                    {plan.campaign_outbound && <Badge variant="outline" className="text-[9px] h-5">Campaigns</Badge>}
                    {plan.raw_prompt_editor && <Badge variant="outline" className="text-[9px] h-5">Prompt</Badge>}
                    {plan.slack_integration && <Badge variant="outline" className="text-[9px] h-5">Slack</Badge>}
                    {plan.crm_integration && <Badge variant="outline" className="text-[9px] h-5">CRM</Badge>}
                    {plan.priority_support && <Badge variant="outline" className="text-[9px] h-5">Priority</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Plan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
