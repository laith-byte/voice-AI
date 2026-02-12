import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { retrieveSubscription, listInvoices, createBillingPortalSession } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  // Get the user's client info
  const { data: userData } = await supabase
    .from("users")
    .select("client_id, organization_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.client_id) {
    return NextResponse.json({ error: "No client found" }, { status: 404 });
  }

  // Use service client to bypass RLS for reading plans
  const serviceClient = await createServiceClient();

  // Get client's full info
  const { data: client } = await serviceClient
    .from("clients")
    .select("stripe_customer_id, stripe_subscription_id, plan_id, organization_id, name")
    .eq("id", userData.client_id)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const orgId = client.organization_id || userData.organization_id;

  // Fetch available plans for this organization
  const { data: plans } = await serviceClient
    .from("client_plans")
    .select("id, name, description, monthly_price, yearly_price, setup_fee, agents_included, call_minutes_included, features, stripe_monthly_price_id, sort_order")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  // Get current plan info if client has a plan_id
  let currentPlan = null;
  if (client.plan_id) {
    const { data: plan } = await serviceClient
      .from("client_plans")
      .select("id, name, description, monthly_price, agents_included, call_minutes_included")
      .eq("id", client.plan_id)
      .single();
    currentPlan = plan;
  }

  // Get the Stripe connected account ID
  const { data: stripeConnection } = await serviceClient
    .from("stripe_connections")
    .select("stripe_account_id")
    .eq("organization_id", orgId)
    .single();

  const stripeAccountId = stripeConnection?.stripe_account_id || undefined;

  let subscription = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let invoices: any[] = [];

  // Fetch subscription details from Stripe
  if (client.stripe_subscription_id) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = await retrieveSubscription(client.stripe_subscription_id, stripeAccountId) as any;
      subscription = {
        id: sub.id,
        status: sub.status,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        plan_name: sub.items?.data?.[0]?.price?.product?.name ?? null,
        plan_amount: sub.items?.data?.[0]?.price?.unit_amount ?? null,
        plan_interval: sub.items?.data?.[0]?.price?.recurring?.interval ?? null,
        plan_currency: sub.items?.data?.[0]?.price?.currency ?? null,
      };
    } catch {
      // Subscription may not exist yet or was deleted
    }
  }

  // Fetch recent invoices
  if (client.stripe_customer_id) {
    try {
      const inv = await listInvoices(stripeAccountId, client.stripe_customer_id);
      invoices = inv.data.slice(0, 12).map((i) => ({
        id: i.id,
        amount_due: i.amount_due,
        currency: i.currency,
        status: i.status ?? null,
        created: i.created,
        invoice_pdf: i.invoice_pdf ?? null,
        hosted_invoice_url: i.hosted_invoice_url ?? null,
      }));
    } catch {
      // No invoices yet
    }
  }

  return NextResponse.json({
    client_name: client.name,
    has_stripe: !!client.stripe_customer_id,
    current_plan: currentPlan,
    plans: plans || [],
    subscription,
    invoices,
  });
}

// POST — create a Stripe billing portal session
export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("client_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.client_id) {
    return NextResponse.json({ error: "No client found" }, { status: 404 });
  }

  const serviceClient = await createServiceClient();

  const { data: client } = await serviceClient
    .from("clients")
    .select("stripe_customer_id, organization_id, slug")
    .eq("id", userData.client_id)
    .single();

  if (!client?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account found" }, { status: 404 });
  }

  const { data: stripeConnection } = await serviceClient
    .from("stripe_connections")
    .select("stripe_account_id")
    .eq("organization_id", client.organization_id)
    .single();

  const stripeAccountId = stripeConnection?.stripe_account_id || undefined;

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/${client.slug}/portal/billing`;

  const session = await createBillingPortalSession(
    client.stripe_customer_id,
    returnUrl,
    stripeAccountId
  );

  return NextResponse.json({ url: session.url });
}
