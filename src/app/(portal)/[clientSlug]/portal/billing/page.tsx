"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CreditCard,
  FileText,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Check,
  Sparkles,
  Calendar,
  ArrowUpRight,
  Users,
  Phone,
  Zap,
  Minus,
  ChevronRight,
  Info,
  Bell,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
} from "lucide-react";
import {
  CLIENT_COST_CATEGORIES,
  RETELL_INFRA_COST,
  TELEPHONY_COST,
  ESTIMATOR_LLM_MODELS,
  ESTIMATOR_VOICE_PROVIDERS,
  ADDON_COSTS,
} from "@/lib/retell-costs";
import { toast } from "sonner";
import type { ClientPlan, PlanAddon, UsageAlertSetting } from "@/types";

interface ForecastData {
  current_spend: number;
  daily_average: number;
  projected_month_end: number;
  days_remaining: number;
  trend: "increasing" | "stable" | "decreasing";
  daily_costs: { date: string; cost: number }[];
}

interface Subscription {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  plan_name: string | null;
  plan_amount: number | null;
  plan_interval: string | null;
  plan_currency: string | null;
}

interface Invoice {
  id: string;
  amount_due: number;
  currency: string;
  status: string | null;
  created: number;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
}

interface ClientAddonWithDetails {
  id: string;
  addon_id: string;
  quantity: number;
  plan_addons: {
    name: string;
    description: string | null;
    monthly_price: number | null;
    one_time_price: number | null;
    addon_type: string;
    category: string;
  };
}

interface BillingData {
  client_name: string;
  has_stripe: boolean;
  current_plan: ClientPlan | null;
  plans: ClientPlan[];
  addons: PlanAddon[];
  client_addons: ClientAddonWithDetails[];
  subscription: Subscription | null;
  invoices: Invoice[];
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Active", variant: "default" },
    trialing: { label: "Trial", variant: "secondary" },
    past_due: { label: "Past Due", variant: "destructive" },
    canceled: { label: "Canceled", variant: "outline" },
    unpaid: { label: "Unpaid", variant: "destructive" },
    paid: { label: "Paid", variant: "default" },
    open: { label: "Open", variant: "secondary" },
    void: { label: "Void", variant: "outline" },
    draft: { label: "Draft", variant: "outline" },
  };
  const info = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

function getEnabledFeatures(plan: ClientPlan): string[] {
  const features: string[] = [];
  if (plan.is_custom_pricing) {
    features.push("Custom AI Agents");
    features.push("Custom Minutes");
    features.push("Custom Phone Numbers");
  } else {
    features.push(`${plan.agents_included} AI Agent${plan.agents_included !== 1 ? "s" : ""}`);
    features.push(`${plan.call_minutes_included.toLocaleString()} minutes/mo`);
    features.push(`${plan.phone_numbers_included} Phone Number${plan.phone_numbers_included !== 1 ? "s" : ""}`);
  }
  if (plan.overage_rate) {
    features.push(`$${plan.overage_rate}/min overage`);
  }
  features.push("All Features Included");
  return features;
}

// Full comparison matrix for the plan comparison dialog
const COMPARISON_CATEGORIES = [
  {
    name: "Usage",
    rows: [
      { label: "Included Minutes", key: "call_minutes_included", type: "number" as const },
      { label: "AI Agents", key: "agents_included", type: "number" as const },
      { label: "Phone Numbers", key: "phone_numbers_included", type: "number" as const },
      { label: "Concurrent Calls", key: "concurrent_calls", type: "number" as const },
      { label: "Knowledge Bases", key: "knowledge_bases", type: "number" as const },
      { label: "Overage Rate", key: "overage_rate", type: "price" as const },
    ],
  },
  {
    name: "Analytics & Insights",
    rows: [
      { label: "Full Analytics Suite", key: "analytics_full", type: "boolean" as const },
      { label: "AI Call Evaluation", key: "ai_evaluation", type: "boolean" as const },
      { label: "Auto-Tagging", key: "ai_auto_tagging", type: "boolean" as const },
      { label: "Misunderstood Query Detection", key: "ai_misunderstood", type: "boolean" as const },
      { label: "Topic Management", key: "topic_management", type: "boolean" as const },
      { label: "Daily Digest", key: "daily_digest", type: "boolean" as const },
      { label: "Analytics Export", key: "analytics_export", type: "boolean" as const },
      { label: "Custom Reporting", key: "custom_reporting", type: "boolean" as const },
    ],
  },
  {
    name: "Automations & Integrations",
    rows: [
      { label: "SMS Notifications", key: "sms_notification", type: "boolean" as const },
      { label: "Caller Follow-up Email", key: "caller_followup_email", type: "boolean" as const },
      { label: "Google Calendar", key: "google_calendar", type: "boolean" as const },
      { label: "Slack Integration", key: "slack_integration", type: "boolean" as const },
      { label: "CRM Integration", key: "crm_integration", type: "boolean" as const },
      { label: "Webhook Forwarding", key: "webhook_forwarding", type: "boolean" as const },
      { label: "Automation Recipes", key: "max_recipes", type: "recipes" as const },
    ],
  },
  {
    name: "Agent Configuration",
    rows: [
      { label: "Voice Selection", key: "voice_selection", type: "selection" as const },
      { label: "LLM Selection", key: "llm_selection", type: "selection" as const },
      { label: "Raw Prompt Editor", key: "raw_prompt_editor", type: "boolean" as const },
      { label: "Functions & Tools", key: "functions_tools", type: "boolean" as const },
      { label: "Pronunciation Dictionary", key: "pronunciation_dict", type: "boolean" as const },
      { label: "Post-Call Analysis Config", key: "post_call_analysis_config", type: "boolean" as const },
      { label: "Campaign Outbound", key: "campaign_outbound", type: "boolean" as const },
      { label: "Full Speech Settings", key: "speech_settings_full", type: "boolean" as const },
      { label: "MCP Configuration", key: "mcp_configuration", type: "boolean" as const },
    ],
  },
  {
    name: "Support & Compliance",
    rows: [
      { label: "Priority Support", key: "priority_support", type: "boolean" as const },
      { label: "Dedicated Account Manager", key: "dedicated_account_manager", type: "boolean" as const },
      { label: "Onboarding Call", key: "onboarding_call", type: "boolean" as const },
      { label: "Custom Agent Buildout", key: "custom_agent_buildout", type: "boolean" as const },
      { label: "SLA Guarantee", key: "sla_guarantee", type: "boolean" as const },
      { label: "HIPAA Compliance", key: "hipaa_compliance", type: "boolean" as const },
      { label: "Custom Branding", key: "custom_branding", type: "boolean" as const },
    ],
  },
];

function getCellValue(plan: ClientPlan, key: string, type: string): React.ReactNode {
  const isCustom = plan.is_custom_pricing;
  const val = (plan as unknown as Record<string, unknown>)[key];
  switch (type) {
    case "boolean":
      return val ? (
        <Check className="w-4 h-4 text-green-600 mx-auto" />
      ) : (
        <Minus className="w-4 h-4 text-gray-300 mx-auto" />
      );
    case "number":
      return (
        <span className="text-sm font-medium">
          {isCustom ? "Custom" : val != null ? Number(val).toLocaleString() : "Custom"}
        </span>
      );
    case "price":
      return (
        <span className="text-sm font-medium">
          {isCustom || val == null ? "Custom" : `$${val}/min`}
        </span>
      );
    case "recipes":
      return (
        <span className="text-sm font-medium">
          {isCustom ? "Custom" : val == null ? "Unlimited" : String(val)}
        </span>
      );
    case "selection":
      return (
        <span className="text-sm font-medium capitalize">
          {isCustom ? "Custom" : val === "full" ? "Full" : "Standard"}
        </span>
      );
    default:
      return <span className="text-sm">{String(val ?? "—")}</span>;
  }
}

function PlanComparisonDialog({
  plans,
  currentPlanId,
  trigger,
}: {
  plans: ClientPlan[];
  currentPlanId: string | undefined;
  trigger: React.ReactNode;
}) {
  const colTemplate = `220px ${plans.map(() => "1fr").join(" ")}`;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-6xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-0 flex-shrink-0">
          <DialogHeader>
            <DialogTitle>Compare Plans</DialogTitle>
          </DialogHeader>

          {/* Sticky plan names row */}
          <div
            className="grid mt-4 pb-3 border-b"
            style={{ gridTemplateColumns: colTemplate }}
          >
            <div />
            {plans.map((plan) => (
              <div key={plan.id} className="text-center">
                <p className="text-sm font-bold">{plan.name}</p>
                {plan.id === currentPlanId && (
                  <Badge variant="outline" className="text-green-600 border-green-300 text-[10px] mt-0.5">
                    Current
                  </Badge>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {plan.is_custom_pricing
                    ? "Custom"
                    : `$${plan.monthly_price}/mo`}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {COMPARISON_CATEGORIES.map((category) => (
            <div key={category.name} className="mt-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {category.name}
              </h3>
              {category.rows.map((row, i) => (
                <div
                  key={row.key}
                  className={`grid items-center py-2 ${
                    i < category.rows.length - 1
                      ? "border-b border-gray-100 dark:border-gray-800"
                      : ""
                  }`}
                  style={{ gridTemplateColumns: colTemplate }}
                >
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  {plans.map((plan) => (
                    <div key={plan.id} className="text-center">
                      {getCellValue(plan, row.key, row.type)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AlertRow({
  alertType,
  label,
  description,
  unit,
  defaultValue,
  defaultPercent,
  setting,
  saving,
  onSave,
}: {
  alertType: string;
  label: string;
  description: string;
  unit: string;
  defaultValue: number;
  defaultPercent: number | null;
  setting: UsageAlertSetting | undefined;
  saving: boolean;
  onSave: (alertType: string, value: number, percent: number | null, enabled: boolean) => void;
}) {
  const isEnabled = setting?.is_enabled ?? false;
  const currentValue = setting?.threshold_value ?? defaultValue;

  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg border">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{label}</p>
          {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {isEnabled && (
          <div className="flex items-center gap-2 mt-2">
            <Input
              type="number"
              className="w-28 h-7 text-xs"
              defaultValue={currentValue}
              min={0}
              onBlur={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0 && val !== currentValue) {
                  onSave(alertType, val, defaultPercent, true);
                }
              }}
            />
            <span className="text-xs text-muted-foreground">{unit}</span>
          </div>
        )}
      </div>
      <Switch
        checked={isEnabled}
        disabled={saving}
        onCheckedChange={(checked) => {
          onSave(alertType, currentValue, defaultPercent, checked);
        }}
      />
    </div>
  );
}

export default function PortalBillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Usage alerts state
  const [alerts, setAlerts] = useState<UsageAlertSetting[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertSaving, setAlertSaving] = useState<string | null>(null);

  // Forecast state
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [forecastLoading, setForecastLoading] = useState(true);

  const fetchBilling = useCallback(async () => {
    try {
      const res = await fetch("/api/client/billing");
      if (!res.ok) throw new Error("Failed to fetch billing");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Billing fetch error:", err);
      toast.error("Failed to load billing information");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/usage/alerts");
      if (res.ok) {
        const json = await res.json();
        setAlerts(json.alerts || []);
      }
    } catch {
      // Alerts are optional, fail silently
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const fetchForecast = useCallback(async () => {
    try {
      const res = await fetch("/api/usage/forecast");
      if (res.ok) {
        const json = await res.json();
        setForecast(json);
      }
    } catch {
      // Forecast is optional, fail silently
    } finally {
      setForecastLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
    fetchAlerts();
    fetchForecast();
  }, [fetchBilling, fetchAlerts, fetchForecast]);

  async function openBillingPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/client/billing", { method: "POST" });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        toast.error(json.error || "Unable to open billing portal");
      }
    } catch {
      toast.error("Failed to open billing portal. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleUpgrade(plan: ClientPlan) {
    if (!plan.stripe_monthly_price_id) {
      toast.error("This plan is not available for checkout yet. Please contact support.");
      return;
    }

    setCheckoutLoading(plan.id);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: plan.id, billing_period: "monthly", return_url: window.location.href }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        toast.error(json.error || "Failed to start checkout. Please try again.");
      }
    } catch {
      toast.error("Something went wrong. Please try again or contact support.");
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function saveAlert(alertType: string, thresholdValue: number, thresholdPercent: number | null, isEnabled: boolean) {
    setAlertSaving(alertType);
    try {
      const res = await fetch("/api/usage/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_type: alertType,
          threshold_value: thresholdValue,
          threshold_percent: thresholdPercent,
          is_enabled: isEnabled,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setAlerts((prev) => {
          const existing = prev.findIndex((a) => a.alert_type === alertType);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = json.alert;
            return updated;
          }
          return [...prev, json.alert];
        });
        toast.success("Alert preference saved");
      } else {
        toast.error("Failed to save alert preference");
      }
    } catch {
      toast.error("Failed to save alert preference");
    } finally {
      setAlertSaving(null);
    }
  }

  function getAlertSetting(alertType: string): UsageAlertSetting | undefined {
    return alerts.find((a) => a.alert_type === alertType);
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const sub = data?.subscription;
  const plans = data?.plans || [];
  const currentPlan = data?.current_plan;
  const addons = data?.addons || [];
  const clientAddons = data?.client_addons || [];
  const invoices = data?.invoices || [];

  const currentPlanId = currentPlan?.id;

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your subscription and payment details
            </p>
          </div>
          {data?.has_stripe && (
            <Button
              onClick={openBillingPortal}
              disabled={portalLoading}
              variant="outline"
              className="gap-2"
            >
              {portalLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Manage Billing
            </Button>
          )}
        </div>

        {/* Active Subscription Card */}
        {sub && (
          <Card className="overflow-hidden animate-fade-in-up glass-card">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <CreditCard className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-sm">Current Subscription</h3>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold">
                      {sub.plan_name || currentPlan?.name || "Current Plan"}
                    </p>
                    {currentPlan?.tagline && (
                      <p className="text-sm text-muted-foreground">{currentPlan.tagline}</p>
                    )}
                    {sub.plan_amount !== null && sub.plan_currency && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatCurrency(sub.plan_amount, sub.plan_currency)}
                        {sub.plan_interval && `/${sub.plan_interval}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {sub.cancel_at_period_end && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Canceling
                      </Badge>
                    )}
                    <Badge variant={sub.status === "active" ? "default" : "destructive"}>
                      {sub.status === "active" ? "Active" : sub.status}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>Started {formatDate(sub.current_period_start)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>
                      {sub.cancel_at_period_end ? "Ends" : "Renews"}{" "}
                      {formatDate(sub.current_period_end)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Plan Details (no Stripe subscription) */}
        {!sub && currentPlan && (
          <Card className="overflow-hidden animate-fade-in-up glass-card">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <CreditCard className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-sm">Current Plan</h3>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{currentPlan.name}</p>
                  {currentPlan.tagline && (
                    <p className="text-sm text-muted-foreground">{currentPlan.tagline}</p>
                  )}
                  {currentPlan.description && (
                    <p className="text-sm text-muted-foreground mt-1">{currentPlan.description}</p>
                  )}
                </div>
                {currentPlan.monthly_price !== null && !currentPlan.is_custom_pricing && (
                  <p className="text-lg font-bold">
                    ${currentPlan.monthly_price}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                )}
                {currentPlan.is_custom_pricing && (
                  <Badge variant="secondary">Custom Plan</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plan Usage Summary */}
        {currentPlan && (
          <Card className="overflow-hidden animate-fade-in-up glass-card">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-sm">Plan Includes</h3>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                  <Clock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-bold">{currentPlan.call_minutes_included.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">minutes/mo</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                  <Users className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-bold">{currentPlan.agents_included}</p>
                  <p className="text-xs text-muted-foreground">AI agents</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                  <Phone className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-bold">{currentPlan.phone_numbers_included ?? 1}</p>
                  <p className="text-xs text-muted-foreground">phone numbers</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                  <Zap className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-bold">{currentPlan.concurrent_calls ?? 5}</p>
                  <p className="text-xs text-muted-foreground">concurrent calls</p>
                </div>
              </div>
              {currentPlan.overage_rate && (
                <p className="text-xs text-muted-foreground mb-3">
                  Overage rate: ${currentPlan.overage_rate}/min beyond included minutes
                </p>
              )}
              {/* What's included in every minute — with pricing details */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                    What&apos;s included in every minute
                  </p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <span className="text-xs text-blue-700 dark:text-blue-300">Platform Infrastructure</span>
                    </div>
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300 tabular-nums">${RETELL_INFRA_COST.toFixed(3)}/min</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <span className="text-xs text-blue-700 dark:text-blue-300">Telephony</span>
                    </div>
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300 tabular-nums">${TELEPHONY_COST.toFixed(3)}/min</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <span className="text-xs text-blue-700 dark:text-blue-300">AI Processing</span>
                    </div>
                    <span className="text-xs text-blue-600 dark:text-blue-400">varies by model</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <span className="text-xs text-blue-700 dark:text-blue-300">Voice Synthesis</span>
                    </div>
                    <span className="text-xs text-blue-600 dark:text-blue-400">varies by provider</span>
                  </div>
                </div>
                {/* Model pricing quick reference */}
                <div className="border-t border-blue-200 dark:border-blue-800 pt-3">
                  <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1.5">AI Model Rates</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {ESTIMATOR_LLM_MODELS.slice(0, 6).map((m) => (
                      <div key={m.key} className="flex items-center justify-between">
                        <span className="text-[10px] text-blue-600 dark:text-blue-400">{m.label}</span>
                        <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300 tabular-nums">${m.cost.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Voice provider pricing */}
                <div className="border-t border-blue-200 dark:border-blue-800 pt-2 mt-2">
                  <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1.5">Voice Provider Rates</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {ESTIMATOR_VOICE_PROVIDERS.map((v) => (
                      <div key={v.key} className="flex items-center justify-between">
                        <span className="text-[10px] text-blue-600 dark:text-blue-400">{v.label}</span>
                        <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300 tabular-nums">
                          {v.cost > 0 ? `$${v.cost.toFixed(3)}` : "included"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Optional add-ons */}
                <div className="border-t border-blue-200 dark:border-blue-800 pt-2 mt-2">
                  <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1.5">Optional Add-Ons</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-blue-600 dark:text-blue-400">Knowledge Base</span>
                      <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300 tabular-nums">+${ADDON_COSTS.knowledgeBase.toFixed(3)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-blue-600 dark:text-blue-400">Adv. Denoising</span>
                      <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300 tabular-nums">+${ADDON_COSTS.advancedDenoising.toFixed(3)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-blue-600 dark:text-blue-400">PII Removal</span>
                      <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300 tabular-nums">+${ADDON_COSTS.piiRemoval.toFixed(3)}</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Enabled Features */}
              {(() => {
                const enabled = getEnabledFeatures(currentPlan);
                if (enabled.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {enabled.map((f) => (
                      <Badge key={f} variant="outline" className="text-xs">
                        <Check className="w-3 h-3 mr-1" />
                        {f}
                      </Badge>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Active Add-ons */}
        {clientAddons.length > 0 && (
          <Card className="overflow-hidden animate-fade-in-up glass-card">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold text-sm">Active Add-ons</h3>
              </div>
            </div>
            <CardContent className="p-0">
              <div className="divide-y">
                {clientAddons.map((ca) => (
                  <div key={ca.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{ca.plan_addons.name}</p>
                      {ca.plan_addons.description && (
                        <p className="text-xs text-muted-foreground">{ca.plan_addons.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {ca.quantity > 1 && (
                        <span className="text-xs text-muted-foreground mr-2">x{ca.quantity}</span>
                      )}
                      <span className="text-sm font-medium">
                        {ca.plan_addons.addon_type === "recurring"
                          ? `$${(ca.plan_addons.monthly_price || 0) * ca.quantity}/mo`
                          : `$${(ca.plan_addons.one_time_price || 0) * ca.quantity}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Plans (Upgrade) */}
        {plans.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-semibold">
                  {sub || currentPlan ? "Upgrade Your Plan" : "Available Plans"}
                </h2>
              </div>
              <PlanComparisonDialog
                plans={plans}
                currentPlanId={currentPlanId}
                trigger={
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1">
                    Compare all plans
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                }
              />
            </div>
            <div className={`grid gap-4 ${plans.length === 1 ? "grid-cols-1 max-w-md" : plans.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"}`}>
              {plans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                const isHighlighted = plan.is_highlighted;
                const isCustom = plan.is_custom_pricing;
                const isLoading = checkoutLoading === plan.id;
                const features = getEnabledFeatures(plan);

                return (
                  <Card
                    key={plan.id}
                    className={`relative overflow-hidden transition-all ${
                      isCurrent
                        ? "border-green-500 border-2 bg-green-50/50 dark:bg-green-950/20"
                        : isHighlighted
                        ? "border-primary border-2 shadow-lg"
                        : ""
                    }`}
                  >
                    {isCurrent && (
                      <Badge className="absolute right-3 top-3 bg-green-600">
                        Current Plan
                      </Badge>
                    )}
                    {plan.badge && !isCurrent && (
                      <Badge className="absolute right-3 top-3 bg-primary">
                        {plan.badge}
                      </Badge>
                    )}
                    <CardContent className="p-5 space-y-4">
                      <div>
                        <h3 className="text-lg font-bold">{plan.name}</h3>
                        {plan.tagline && (
                          <p className="text-xs text-muted-foreground mt-0.5">{plan.tagline}</p>
                        )}
                      </div>
                      <div>
                        {isCustom ? (
                          <>
                            <span className="text-3xl font-bold">Custom</span>
                            <p className="text-xs text-muted-foreground mt-1">
                              Tailored to your needs
                            </p>
                          </>
                        ) : (
                          <>
                            <span className="text-3xl font-bold">
                              ${plan.monthly_price ?? 0}
                            </span>
                            <span className="text-muted-foreground">/mo</span>
                          </>
                        )}
                        {/* Yearly pricing hidden until billing period selection is implemented */}
                      </div>

                      {/* Usage stats */}
                      {isCustom ? (
                        <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/30 text-center">
                          <div>
                            <p className="text-xs font-semibold">Custom</p>
                            <p className="text-[10px] text-muted-foreground">min/mo</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold">Custom</p>
                            <p className="text-[10px] text-muted-foreground">agents</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold">Custom</p>
                            <p className="text-[10px] text-muted-foreground">numbers</p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/30 text-center">
                          <div>
                            <p className="text-xs font-semibold">{plan.call_minutes_included.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">min/mo</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold">{plan.agents_included}</p>
                            <p className="text-[10px] text-muted-foreground">agents</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold">{plan.phone_numbers_included ?? 1}</p>
                            <p className="text-[10px] text-muted-foreground">numbers</p>
                          </div>
                        </div>
                      )}

                      {/* Key features */}
                      {features.length > 0 && (
                        <ul className="space-y-1.5">
                          {features.slice(0, 6).map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-sm">
                              <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                              <span className="text-xs">{feature}</span>
                            </li>
                          ))}
                          {features.length > 6 && (
                            <li>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <PlanComparisonDialog
                                    plans={plans}
                                    currentPlanId={currentPlanId}
                                    trigger={
                                      <button className="text-xs text-primary hover:underline cursor-pointer pl-5 flex items-center gap-1">
                                        +{features.length - 6} more features
                                        <ChevronRight className="w-3 h-3" />
                                      </button>
                                    }
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="bottom" align="start" className="max-w-xs">
                                  <ul className="space-y-1 py-1">
                                    {features.slice(6).map((f) => (
                                      <li key={f} className="flex items-center gap-1.5 text-xs">
                                        <Check className="w-3 h-3 text-green-600 flex-shrink-0" />
                                        {f}
                                      </li>
                                    ))}
                                  </ul>
                                  <p className="text-[10px] text-muted-foreground mt-1.5 border-t pt-1.5">
                                    Click to compare all plans
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </li>
                          )}
                        </ul>
                      )}

                      {isCurrent ? (
                        <Button variant="outline" className="w-full" disabled>
                          <CheckCircle2 className="w-4 h-4 mr-1.5" />
                          Current Plan
                        </Button>
                      ) : isCustom ? (
                        <Button variant="outline" className="w-full" asChild>
                          <a href="mailto:sales@invarialabs.com">
                            Contact Sales
                          </a>
                        </Button>
                      ) : (
                        <Button
                          className={`w-full ${isHighlighted ? "bg-primary hover:bg-primary/90" : ""}`}
                          variant={isHighlighted ? "default" : "outline"}
                          onClick={() => handleUpgrade(plan)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                              Redirecting...
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-4 h-4 mr-1.5" />
                              Upgrade
                            </>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Cost Forecast */}
        <Card className="overflow-hidden animate-fade-in-up glass-card">
          <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-sm">Cost Forecast</h3>
            </div>
          </div>
          <CardContent className="p-4">
            {forecastLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : forecast ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                    <DollarSign className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">${forecast.current_spend.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">spent this month</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                    <Activity className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">${forecast.daily_average.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">daily average</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                    <TrendingUp className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">${forecast.projected_month_end.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">projected month-end</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                    <Calendar className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">{forecast.days_remaining}</p>
                    <p className="text-xs text-muted-foreground">days remaining</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-1">
                  {forecast.trend === "increasing" ? (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <TrendingUp className="w-3 h-3" /> Increasing
                    </Badge>
                  ) : forecast.trend === "decreasing" ? (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <TrendingDown className="w-3 h-3" /> Decreasing
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Activity className="w-3 h-3" /> Stable
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Daily spend trend over the last 30 days
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No usage data available yet. Cost forecasts will appear once you have call activity.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Usage Alerts */}
        <Card className="overflow-hidden animate-fade-in-up glass-card">
          <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-semibold text-sm">Usage Alerts</h3>
            </div>
          </div>
          <CardContent className="p-4">
            {alertsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Get notified by email when your usage approaches or exceeds these thresholds.
                </p>
                {/* Minutes alert */}
                <AlertRow
                  alertType="minutes_threshold"
                  label="Minutes Usage"
                  description="Alert when call minutes reach a threshold"
                  unit="minutes"
                  defaultValue={500}
                  defaultPercent={80}
                  setting={getAlertSetting("minutes_threshold")}
                  saving={alertSaving === "minutes_threshold"}
                  onSave={saveAlert}
                />
                {/* Cost alert */}
                <AlertRow
                  alertType="cost_threshold"
                  label="Cost Threshold"
                  description="Alert when estimated cost exceeds a dollar amount"
                  unit="$"
                  defaultValue={100}
                  defaultPercent={null}
                  setting={getAlertSetting("cost_threshold")}
                  saving={alertSaving === "cost_threshold"}
                  onSave={saveAlert}
                />
                {/* Calls alert */}
                <AlertRow
                  alertType="calls_threshold"
                  label="Call Count"
                  description="Alert when total calls exceed a number"
                  unit="calls"
                  defaultValue={200}
                  defaultPercent={null}
                  setting={getAlertSetting("calls_threshold")}
                  saving={alertSaving === "calls_threshold"}
                  onSave={saveAlert}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom / Enterprise CTA */}
        <Card className="overflow-hidden animate-fade-in-up glass-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Need a custom deployment?</p>
                  <p className="text-xs text-muted-foreground">
                    Talk to our team about enterprise plans, custom integrations, and dedicated support.
                  </p>
                </div>
              </div>
              <Button variant="outline" className="gap-2 shrink-0" asChild>
                <a href="mailto:sales@invarialabs.com">
                  <Calendar className="w-4 h-4" />
                  Contact Sales
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Invoices */}
        {invoices.length > 0 && (
          <Card className="overflow-hidden animate-fade-in-up glass-card">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-sm">Invoices</h3>
              </div>
            </div>
            <CardContent className="p-0">
              <div className="divide-y">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {formatCurrency(inv.amount_due, inv.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(inv.created)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {inv.status && <InvoiceStatusBadge status={inv.status} />}
                      {inv.invoice_pdf && (
                        <a
                          href={inv.invoice_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      {inv.hosted_invoice_url && (
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="View invoice"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No subscription + no plans fallback */}
        {!sub && !currentPlan && plans.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                No billing information available yet. Contact your provider for plan details.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
