"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check,
  Minus,
  Loader2,
  Phone,
  Users,
  Clock,
  Zap,
  ChevronDown,
  HelpCircle,
} from "lucide-react";
import type { ClientPlan, PlanAddon } from "@/types";

interface PricingCardsProps {
  plans: ClientPlan[];
  addons: PlanAddon[];
  orgSlug: string;
  stripeAccountId: string | null;
}

// Feature comparison matrix categories
const FEATURE_CATEGORIES = [
  {
    name: "Analytics & Insights",
    features: [
      { label: "Basic Analytics", key: "analytics_basic", allPlans: true },
      { label: "Full Analytics Suite", key: "analytics_full" },
      { label: "AI Call Evaluation", key: "ai_evaluation" },
      { label: "Auto-Tagging", key: "ai_auto_tagging" },
      { label: "Misunderstood Query Detection", key: "ai_misunderstood" },
      { label: "Topic Management", key: "topic_management" },
      { label: "Daily Digest", key: "daily_digest" },
      { label: "Analytics Export", key: "analytics_export" },
      { label: "Custom Reporting", key: "custom_reporting" },
    ],
  },
  {
    name: "Automations & Integrations",
    features: [
      { label: "SMS Notification", key: "sms_notification" },
      { label: "Caller Follow-up Email", key: "caller_followup_email" },
      { label: "Google Calendar", key: "google_calendar" },
      { label: "Slack Integration", key: "slack_integration" },
      { label: "CRM Integration", key: "crm_integration" },
      { label: "Webhook Forwarding", key: "webhook_forwarding" },
    ],
  },
  {
    name: "Agent Configuration",
    features: [
      { label: "Advanced Voice Selection", key: "voice_full" },
      { label: "Advanced LLM Selection", key: "llm_full" },
      { label: "Raw Prompt Editor", key: "raw_prompt_editor" },
      { label: "Functions & Tools", key: "functions_tools" },
      { label: "Pronunciation Dictionary", key: "pronunciation_dict" },
      { label: "Post-Call Analysis Config", key: "post_call_analysis_config" },
      { label: "Campaign Outbound", key: "campaign_outbound" },
      { label: "MCP Configuration", key: "mcp_configuration" },
      { label: "Full Speech Settings", key: "speech_settings_full" },
    ],
  },
  {
    name: "Support & Compliance",
    features: [
      { label: "Email Support", key: "email_support", allPlans: true },
      { label: "Priority Support", key: "priority_support" },
      { label: "Dedicated Account Manager", key: "dedicated_account_manager" },
      { label: "Onboarding Call", key: "onboarding_call" },
      { label: "Custom Agent Buildout", key: "custom_agent_buildout" },
      { label: "SLA Guarantee", key: "sla_guarantee" },
      { label: "HIPAA Compliance", key: "hipaa_compliance" },
      { label: "Custom Branding", key: "custom_branding" },
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: "How does the free trial work?",
    a: "Start with any plan and get a one-time setup session included. No long-term contracts — cancel anytime.",
  },
  {
    q: "What happens if I go over my minutes?",
    a: "You'll be billed at your plan's per-minute overage rate. We'll notify you when you're approaching your limit so there are no surprises.",
  },
  {
    q: "Can I change plans later?",
    a: "Absolutely. You can upgrade or downgrade at any time. When upgrading, you'll get immediate access to new features. When downgrading, changes take effect at your next billing cycle.",
  },
  {
    q: "What's included in the setup fee?",
    a: "The one-time setup fee covers initial agent configuration, voice selection, prompt engineering, and a kickoff call to ensure your AI agent is perfectly tuned for your business.",
  },
  {
    q: "Do you offer custom enterprise pricing?",
    a: "Yes! Our Enterprise plan is fully customizable. Contact our sales team to discuss volume discounts, custom integrations, SLA guarantees, and HIPAA compliance.",
  },
  {
    q: "How does billing work for add-ons?",
    a: "Recurring add-ons (extra agents, phone numbers) are billed monthly alongside your plan. One-time add-ons (done-for-you builds, custom automations) are charged once at purchase.",
  },
];

function getFeatureValue(plan: ClientPlan, key: string): boolean {
  if (key === "analytics_basic" || key === "email_support") return true;
  if (key === "voice_full") return plan.voice_selection === "full";
  if (key === "llm_full") return plan.llm_selection === "full";
  return (plan as unknown as Record<string, unknown>)[key] === true;
}

function getKeyFeatures(plan: ClientPlan): string[] {
  const features: string[] = [];
  if (plan.is_custom_pricing) {
    features.push("Custom AI Agents");
    features.push("Custom minutes/mo");
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

export default function PricingCards({ plans, addons, orgSlug, stripeAccountId }: PricingCardsProps) {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);

  async function handleGetStarted(plan: ClientPlan) {
    if (plan.is_custom_pricing) {
      window.location.href = `mailto:sales@invarialabs.com?subject=Enterprise Plan Inquiry`;
      return;
    }

    const priceId = isAnnual ? plan.stripe_yearly_price_id : plan.stripe_monthly_price_id;
    if (!priceId) return;

    setLoadingPlanId(plan.id);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: plan.id,
          billing_period: isAnnual ? "yearly" : "monthly",
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoadingPlanId(null);
    }
  }

  if (plans.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">No plans available yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Simple Pricing. Powerful AI.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Replace your $3,500/mo receptionist with an AI voice agent that works 24/7,
            never takes a day off, and costs a fraction of the price.
          </p>
        </div>

        {/* Monthly / Annual Toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm font-medium ${!isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
            Monthly
          </span>
          <Switch
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
          />
          <span className={`text-sm font-medium ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
            Annual
          </span>
          {isAnnual && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-xs">
              Save ~20%
            </Badge>
          )}
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {plans.map((plan) => {
            const isHighlighted = plan.is_highlighted;
            const hasBadge = !!plan.badge;
            const features = getKeyFeatures(plan);
            const isCustom = plan.is_custom_pricing;
            const priceId = isAnnual ? plan.stripe_yearly_price_id : plan.stripe_monthly_price_id;
            const canCheckout = isCustom || !!priceId;
            const isLoading = loadingPlanId === plan.id;

            const displayPrice = isCustom
              ? null
              : isAnnual && plan.yearly_price
                ? Math.round(plan.yearly_price / 12)
                : plan.monthly_price;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  isHighlighted
                    ? "border-blue-600 border-2 shadow-xl shadow-blue-600/10 scale-[1.02]"
                    : "border-gray-200"
                }`}
              >
                {hasBadge && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3">
                    {plan.badge}
                  </Badge>
                )}
                <CardHeader className="text-center pb-4 pt-6">
                  <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                  {plan.tagline && (
                    <p className="text-sm text-muted-foreground mt-1">{plan.tagline}</p>
                  )}
                  <div className="mt-4">
                    {isCustom ? (
                      <span className="text-3xl font-bold">Custom</span>
                    ) : (
                      <>
                        <span className="text-4xl font-bold">
                          ${displayPrice ?? 0}
                        </span>
                        <span className="text-muted-foreground">/mo</span>
                        {isAnnual && plan.yearly_price && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ${plan.yearly_price.toLocaleString()}/year billed annually
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  {/* Usage Summary */}
                  <div className="grid grid-cols-3 gap-2 mb-5 p-3 rounded-lg bg-gray-50">
                    <div className="text-center">
                      <Clock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs font-semibold">{plan.call_minutes_included.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">min/mo</p>
                    </div>
                    <div className="text-center">
                      <Users className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs font-semibold">{plan.agents_included}</p>
                      <p className="text-[10px] text-muted-foreground">agents</p>
                    </div>
                    <div className="text-center">
                      <Phone className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs font-semibold">{plan.phone_numbers_included}</p>
                      <p className="text-[10px] text-muted-foreground">numbers</p>
                    </div>
                  </div>

                  {plan.overage_rate && (
                    <p className="text-xs text-muted-foreground text-center mb-4">
                      Overage: ${plan.overage_rate}/min
                    </p>
                  )}

                  {/* Key Features Checklist */}
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    className={`w-full ${isHighlighted ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                    variant={isHighlighted ? "default" : "outline"}
                    size="lg"
                    disabled={!canCheckout || isLoading}
                    onClick={() => handleGetStarted(plan)}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Redirecting...
                      </>
                    ) : isCustom ? (
                      "Contact Sales"
                    ) : isHighlighted ? (
                      "Start Pro Plan"
                    ) : (
                      "Get Started"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add-ons Section */}
        {addons.length > 0 && (
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold">Add-ons</h2>
              <p className="text-muted-foreground mt-1">
                Enhance your plan with additional capabilities
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {addons.map((addon) => (
                <Card key={addon.id} className="border-gray-200">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Zap className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold">{addon.name}</h3>
                      {addon.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{addon.description}</p>
                      )}
                      <p className="text-sm font-medium mt-1.5">
                        {addon.addon_type === "recurring"
                          ? `$${addon.monthly_price}/mo`
                          : `$${addon.one_time_price} one-time`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Feature Comparison Accordion */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">Compare Plans</h2>
            <p className="text-muted-foreground mt-1">
              See exactly what&apos;s included in each plan
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            {/* Header row */}
            <div className="grid gap-4 mb-2" style={{ gridTemplateColumns: `1fr ${plans.map(() => "100px").join(" ")}` }}>
              <div />
              {plans.map((plan) => (
                <div key={plan.id} className="text-center">
                  <span className="text-sm font-semibold">{plan.name}</span>
                </div>
              ))}
            </div>

            <Accordion type="multiple" defaultValue={[FEATURE_CATEGORIES[0].name]}>
              {FEATURE_CATEGORIES.map((category) => (
                <AccordionItem key={category.name} value={category.name}>
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    {category.name}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-0">
                      {category.features.map((feature) => (
                        <div
                          key={feature.key}
                          className="grid gap-4 py-2.5 border-b border-gray-100 last:border-0 items-center"
                          style={{ gridTemplateColumns: `1fr ${plans.map(() => "100px").join(" ")}` }}
                        >
                          <span className="text-sm text-muted-foreground">{feature.label}</span>
                          {plans.map((plan) => {
                            const hasFeature = feature.allPlans || getFeatureValue(plan, feature.key);
                            return (
                              <div key={plan.id} className="flex justify-center">
                                {hasFeature ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Minus className="w-4 h-4 text-gray-300" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
          </div>
          <Accordion type="single" collapsible>
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger className="text-sm font-medium text-left hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">{item.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            All prices in USD. Cancel anytime. Need a custom plan?{" "}
            <a href="mailto:sales@invarialabs.com" className="text-blue-600 hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
