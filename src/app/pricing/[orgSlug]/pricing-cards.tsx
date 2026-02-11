"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import type { ClientPlan } from "@/types";

interface PricingCardsProps {
  plans: ClientPlan[];
  orgSlug: string;
  stripeAccountId: string | null;
}

export default function PricingCards({ plans, orgSlug, stripeAccountId }: PricingCardsProps) {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  // Mark the middle plan as "popular" if there are 3+ plans, otherwise none
  const popularIndex = plans.length >= 3 ? 1 : -1;

  async function handleGetStarted(plan: ClientPlan) {
    if (!stripeAccountId || !plan.stripe_monthly_price_id) return;

    setLoadingPlanId(plan.id);
    try {
      const lineItems: { price: string; quantity: number }[] = [
        { price: plan.stripe_monthly_price_id, quantity: 1 },
      ];

      // Add setup fee as a separate line item if configured
      if (plan.stripe_setup_price_id) {
        lineItems.push({ price: plan.stripe_setup_price_id, quantity: 1 });
      }

      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_checkout",
          stripe_account_id: stripeAccountId,
          line_items: lineItems,
          success_url: `${window.location.origin}/pricing/${orgSlug}?success=true`,
          cancel_url: `${window.location.origin}/pricing/${orgSlug}?canceled=true`,
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
      <div className="text-center py-16">
        <p className="text-muted-foreground">No plans available yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {plans.map((plan, index) => {
        const isPopular = index === popularIndex;
        const features = Array.isArray(plan.features)
          ? (plan.features as string[])
          : [];
        const canCheckout = !!stripeAccountId && !!plan.stripe_monthly_price_id;
        const isLoading = loadingPlanId === plan.id;

        return (
          <Card
            key={plan.id}
            className={`relative ${isPopular ? "border-blue-600 border-2 shadow-lg scale-105" : ""}`}
          >
            {isPopular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600">
                Most Popular
              </Badge>
            )}
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              {plan.description && (
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              )}
              <div className="mt-4">
                <span className="text-4xl font-bold">
                  ${plan.monthly_price ?? 0}
                </span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              {plan.setup_fee > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  + ${plan.setup_fee} one-time setup fee
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full ${isPopular ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                variant={isPopular ? "default" : "outline"}
                disabled={!canCheckout || isLoading}
                onClick={() => handleGetStarted(plan)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Redirecting...
                  </>
                ) : canCheckout ? (
                  "Get Started"
                ) : (
                  "Coming Soon"
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
