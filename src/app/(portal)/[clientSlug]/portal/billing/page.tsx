"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  setup_fee: number;
  agents_included: number;
  call_minutes_included: number;
  features: string[] | null;
  stripe_monthly_price_id: string | null;
  sort_order: number;
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

interface CurrentPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number | null;
  agents_included: number;
  call_minutes_included: number;
}

interface BillingData {
  client_name: string;
  has_stripe: boolean;
  current_plan: CurrentPlan | null;
  plans: Plan[];
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

export default function PortalBillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    try {
      const res = await fetch("/api/client/billing");
      if (!res.ok) throw new Error("Failed to fetch billing");
      const json = await res.json();
      setData(json);
    } catch {
      // Billing data not available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  async function openBillingPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/client/billing", { method: "POST" });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      }
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleUpgrade(planId: string) {
    setCheckoutLoading(planId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      }
    } finally {
      setCheckoutLoading(null);
    }
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
  const invoices = data?.invoices || [];

  // Determine which plan is "current" — match by plan_id or by subscription plan name
  const currentPlanId = currentPlan?.id;

  // Mark the middle plan as popular if 3+ plans
  const popularIndex = plans.length >= 3 ? 1 : -1;

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
                    {sub.plan_amount !== null && sub.plan_currency && (
                      <p className="text-sm text-muted-foreground">
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

        {/* Current Plan (no Stripe subscription) */}
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
                  {currentPlan.description && (
                    <p className="text-sm text-muted-foreground">{currentPlan.description}</p>
                  )}
                </div>
                {currentPlan.monthly_price !== null && (
                  <p className="text-lg font-bold">
                    ${currentPlan.monthly_price}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Plans */}
        {plans.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-lg font-semibold">
                {sub || currentPlan ? "Upgrade Your Plan" : "Available Plans"}
              </h2>
            </div>
            <div className={`grid gap-4 ${plans.length === 1 ? "grid-cols-1 max-w-md" : plans.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"}`}>
              {plans.map((plan, index) => {
                const isPopular = index === popularIndex;
                const isCurrent = plan.id === currentPlanId;
                const rawFeatures = plan.features;
                const features: string[] = Array.isArray(rawFeatures)
                  ? rawFeatures
                  : typeof rawFeatures === "string"
                  ? (() => { try { const p = JSON.parse(rawFeatures); return Array.isArray(p) ? p : []; } catch { return []; } })()
                  : [];
                const canCheckout = !!plan.stripe_monthly_price_id && !isCurrent;
                const isLoading = checkoutLoading === plan.id;

                return (
                  <Card
                    key={plan.id}
                    className={`relative overflow-hidden transition-all ${
                      isCurrent
                        ? "border-green-500 border-2 bg-green-50/50 dark:bg-green-950/20"
                        : isPopular
                        ? "border-primary border-2 shadow-lg"
                        : ""
                    }`}
                  >
                    {isCurrent && (
                      <Badge className="absolute -top-0 right-3 top-3 bg-green-600">
                        Current Plan
                      </Badge>
                    )}
                    {isPopular && !isCurrent && (
                      <Badge className="absolute right-3 top-3 bg-primary">
                        Most Popular
                      </Badge>
                    )}
                    <CardContent className="p-5 space-y-4">
                      <div>
                        <h3 className="text-lg font-bold">{plan.name}</h3>
                        {plan.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-3xl font-bold">
                          ${plan.monthly_price ?? 0}
                        </span>
                        <span className="text-muted-foreground">/mo</span>
                        {plan.setup_fee > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            + ${plan.setup_fee} one-time setup
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>{plan.agents_included} agent{plan.agents_included !== 1 ? "s" : ""} included</p>
                        <p>{plan.call_minutes_included.toLocaleString()} minutes/mo</p>
                      </div>
                      {features.length > 0 && (
                        <ul className="space-y-2">
                          {features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      )}
                      {isCurrent ? (
                        <Button variant="outline" className="w-full" disabled>
                          <CheckCircle2 className="w-4 h-4 mr-1.5" />
                          Current Plan
                        </Button>
                      ) : canCheckout ? (
                        <Button
                          className={`w-full ${isPopular ? "bg-primary hover:bg-primary/90" : ""}`}
                          variant={isPopular ? "default" : "outline"}
                          onClick={() => handleUpgrade(plan.id)}
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
                              {sub || currentPlan ? "Upgrade" : "Get Started"}
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button variant="outline" className="w-full" disabled>
                          Coming Soon
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

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
