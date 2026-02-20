import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/stripe";
import { getClientIp, publicEndpointLimiter, rateLimitExceeded } from "@/lib/rate-limit";

const PLAN_ID_MAP: Record<string, string | undefined> = {
  starter: process.env.PLATFORM_PLAN_ID_STARTER,
  professional: process.env.PLATFORM_PLAN_ID_PROFESSIONAL,
};

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed, resetMs } = publicEndpointLimiter.check(ip);
  if (!allowed) return rateLimitExceeded(resetMs);

  try {
    const { plan, billing_period } = await request.json();

    const planId = PLAN_ID_MAP[plan];
    if (!planId) {
      return NextResponse.json(
        { error: `Unknown plan: ${plan}` },
        { status: 400 }
      );
    }

    const isYearly = billing_period === "yearly";
    const supabase = await createServiceClient();

    // 1. Look up the plan
    const { data: planData, error: planError } = await supabase
      .from("client_plans")
      .select("*, organization_id")
      .eq("id", planId)
      .eq("is_active", true)
      .single();

    if (planError || !planData) {
      console.error("Plan not found:", planId, planError?.message);
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const recurringPriceId = isYearly
      ? planData.stripe_yearly_price_id
      : planData.stripe_monthly_price_id;

    if (!recurringPriceId) {
      return NextResponse.json(
        { error: "Plan has no Stripe price configured for this billing period" },
        { status: 400 }
      );
    }

    // 2. Look up the organization
    const { data: org } = await supabase
      .from("organizations")
      .select("id, slug")
      .eq("id", planData.organization_id)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // 3. Check for Stripe connected account
    const { data: stripeConn } = await supabase
      .from("stripe_connections")
      .select("stripe_account_id")
      .eq("organization_id", org.id)
      .eq("is_connected", true)
      .single();

    const stripeAccountId = stripeConn?.stripe_account_id || undefined;
    // Use request origin so success/cancel URLs match the actual running server
    const appUrl = request.nextUrl.origin;

    // 4. Create Stripe checkout session
    const session = await createCheckoutSession(
      {
        mode: "subscription",
        line_items: [{ price: recurringPriceId, quantity: 1 }],
        success_url: `${appUrl}/signup?success=true`,
        cancel_url: `${appUrl}/signup?canceled=true`,
        metadata: {
          plan_id: planData.id,
          organization_id: org.id,
          org_slug: org.slug,
          plan_name: planData.name || "",
        },
        subscription_data: {
          metadata: {
            plan_id: planData.id,
            organization_id: org.id,
          },
        },
      },
      stripeAccountId
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Marketing checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
