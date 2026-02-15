import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Public checkout endpoint — no auth required.
 * Creates a Stripe Checkout session with plan metadata so the
 * webhook can auto-provision the client after payment.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { plan_id, billing_period, return_url } = body;
  const isYearly = billing_period === "yearly";

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

  const recurringPriceId = isYearly ? plan.stripe_yearly_price_id : plan.stripe_monthly_price_id;
  if (!recurringPriceId) {
    return NextResponse.json({ error: "Plan has no Stripe price configured for this billing period" }, { status: 400 });
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

  if (!stripeConn) {
    console.warn(`No Stripe connected account for org ${org.id} — checkout will use platform account`);
  }

  // 4. Validate return_url if provided (must be same origin)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  let safeReturnUrl: string | null = null;
  if (return_url) {
    try {
      const parsed = new URL(return_url);
      const appParsed = new URL(appUrl);
      if (parsed.origin === appParsed.origin) {
        safeReturnUrl = return_url;
      }
    } catch {
      // Invalid URL, ignore
    }
  }

  // 5. Build line items
  const lineItems: { price: string; quantity: number }[] = [
    { price: recurringPriceId, quantity: 1 },
  ];

  // 6. Create checkout session with metadata
  try {
    const stripeLib = await import("@/lib/stripe");
    const stripeAccountId = stripeConn?.stripe_account_id || undefined;

    const session = await stripeLib.createCheckoutSession(
      {
        mode: "subscription",
        line_items: lineItems,
        success_url: safeReturnUrl
          ? `${safeReturnUrl}?success=true`
          : `${appUrl}/pricing/${org.slug}?success=true`,
        cancel_url: safeReturnUrl
          ? safeReturnUrl
          : `${appUrl}/pricing/${org.slug}?canceled=true`,
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
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
