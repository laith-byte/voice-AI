import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Public checkout endpoint — no auth required.
 * Creates a Stripe Checkout session with plan metadata so the
 * webhook can auto-provision the client after payment.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { plan_id } = body;

  if (!plan_id) {
    return NextResponse.json({ error: "plan_id is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // 1. Look up the plan
  const { data: plan, error: planError } = await supabase
    .from("client_plans")
    .select("*, organization_id")
    .eq("id", plan_id)
    .eq("is_active", true)
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (!plan.stripe_monthly_price_id) {
    return NextResponse.json({ error: "Plan has no Stripe price configured" }, { status: 400 });
  }

  // 2. Look up the organization for slug
  const { data: org } = await supabase
    .from("organizations")
    .select("id, slug")
    .eq("id", plan.organization_id)
    .single();

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // 3. Get the Stripe connected account
  const { data: stripeConn } = await supabase
    .from("stripe_connections")
    .select("stripe_account_id")
    .eq("organization_id", org.id)
    .eq("is_connected", true)
    .single();

  // 4. Build line items
  const lineItems: { price: string; quantity: number }[] = [
    { price: plan.stripe_monthly_price_id, quantity: 1 },
  ];
  if (plan.stripe_setup_price_id) {
    lineItems.push({ price: plan.stripe_setup_price_id, quantity: 1 });
  }

  // 5. Create checkout session with metadata
  const stripeLib = await import("@/lib/stripe");
  const stripeAccountId = stripeConn?.stripe_account_id || undefined;

  const session = await stripeLib.createCheckoutSession(
    {
      mode: "subscription",
      line_items: lineItems,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing/${org.slug}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing/${org.slug}?canceled=true`,
      metadata: {
        plan_id: plan.id,
        organization_id: org.id,
        org_slug: org.slug,
        plan_name: plan.name || "",
      },
      subscription_data: {
        metadata: {
          plan_id: plan.id,
          organization_id: org.id,
        },
      },
    },
    stripeAccountId
  );

  return NextResponse.json({ url: session.url });
}
