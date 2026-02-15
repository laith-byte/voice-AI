import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";

// Disable body parsing — Stripe needs the raw body for signature verification
export const dynamic = "force-dynamic";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // Read raw body for signature verification
  const rawBody = await request.text();

  let event;
  try {
    event = constructWebhookEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Log the event
  const supabase = await createServiceClient();

  // Extract organization_id from event metadata if available
  const eventObj = event.data.object as unknown as Record<string, unknown>;
  const eventOrgId = (eventObj?.metadata as Record<string, string>)?.organization_id || null;

  const { data: logRow } = await supabase.from("webhook_logs").insert({
    organization_id: eventOrgId,
    event: event.type,
    raw_payload: eventObj,
    import_result: "processing",
    timestamp: new Date().toISOString(),
  }).select("id").single();

  // Handle events
  switch (event.type) {
    case "checkout.session.completed": {
      await handleCheckoutCompleted(event.data.object, supabase);
      break;
    }
    case "customer.subscription.deleted": {
      await handleSubscriptionDeleted(event.data.object, supabase);
      break;
    }
    case "customer.subscription.updated": {
      await handleSubscriptionUpdated(event.data.object, supabase);
      break;
    }
    case "invoice.payment_failed": {
      await handlePaymentFailed(event.data.object, supabase);
      break;
    }
    default:
      // Acknowledge unhandled events
      break;
  }

  // Mark the webhook log as processed
  if (logRow?.id) {
    await supabase
      .from("webhook_logs")
      .update({ import_result: "success" })
      .eq("id", logRow.id);
  }

  return NextResponse.json({ received: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCheckoutCompleted(session: any, supabase: any) {
  const metadata = session.metadata || {};
  const { plan_id, organization_id, org_slug } = metadata;

  if (!plan_id || !organization_id) {
    console.error("Checkout session missing plan_id or organization_id metadata");
    return;
  }

  const customerEmail = session.customer_details?.email || session.customer_email;
  if (!customerEmail) {
    console.error("Checkout session has no customer email");
    return;
  }

  // 1. Look up the plan to get feature configuration
  const { data: plan } = await supabase
    .from("client_plans")
    .select("*")
    .eq("id", plan_id)
    .single();

  if (!plan) {
    console.error("Plan not found:", plan_id);
    return;
  }

  // 2. Check if client already exists for this email (idempotent)
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, client_id")
    .eq("email", customerEmail)
    .limit(1)
    .maybeSingle();

  if (existingUser?.client_id) {
    console.log("Client already exists for email:", customerEmail);
    return;
  }

  // 3. Create the client
  const clientName = customerEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  let slug = generateSlug(clientName);

  // Ensure slug uniqueness
  const { data: existingSlug } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", slug)
    .eq("organization_id", organization_id)
    .maybeSingle();

  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      organization_id,
      name: clientName,
      slug,
      status: "active",
      plan_id: plan_id,
      stripe_customer_id: session.customer || null,
      stripe_subscription_id: session.subscription || null,
    })
    .select("id")
    .single();

  if (clientError || !client) {
    console.error("Failed to create client:", clientError?.message);
    return;
  }

  console.log("Created client:", client.id, "slug:", slug);

  // 4. Create auth user via Supabase Admin API (invite by email)
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    customerEmail,
    {
      data: {
        role: "client_admin",
        full_name: clientName,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/${slug}/portal/onboarding`,
    }
  );

  if (inviteError) {
    console.error("Failed to invite user:", inviteError.message);
    // Try to see if user already exists in auth
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existingAuthUser = users?.find((u: { email?: string }) => u.email === customerEmail);
    if (existingAuthUser) {
      // User exists in auth but not linked to a client — create the users row
      await createUserRow(supabase, existingAuthUser.id, customerEmail, organization_id, client.id);
    } else {
      return;
    }
  } else if (inviteData?.user) {
    // 5. Create users table row
    await createUserRow(supabase, inviteData.user.id, customerEmail, organization_id, client.id);
  }

  // 6. Set client_access permissions based on plan
  await setClientPermissions(supabase, client.id, plan);

  // 7. Create client_onboarding record
  await supabase.from("client_onboarding").insert({
    client_id: client.id,
    status: "not_started",
    current_step: 1,
  });

  console.log("Auto-provisioning complete for:", customerEmail, "→", slug);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionDeleted(subscription: any, supabase: any) {
  const subscriptionId = subscription.id;
  if (!subscriptionId) return;

  // Find the client with this subscription and deactivate them
  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (!client) {
    console.log("No client found for cancelled subscription:", subscriptionId);
    return;
  }

  const { error } = await supabase
    .from("clients")
    .update({ status: "cancelled", stripe_subscription_id: null })
    .eq("id", client.id);

  if (error) {
    console.error("Failed to deactivate client:", error.message);
  } else {
    console.log("Client deactivated due to subscription cancellation:", client.name);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionUpdated(subscription: any, supabase: any) {
  const subscriptionId = subscription.id;
  if (!subscriptionId) return;

  // Update the client's subscription status if it changed to past_due or unpaid
  const status = subscription.status; // active, past_due, unpaid, canceled, etc.
  if (status === "past_due" || status === "unpaid") {
    const { error } = await supabase
      .from("clients")
      .update({ status: "past_due" })
      .eq("stripe_subscription_id", subscriptionId);

    if (error) {
      console.error("Failed to update client status to past_due:", error.message);
    }
  } else if (status === "active") {
    // Reactivate if payment is resolved
    const { error } = await supabase
      .from("clients")
      .update({ status: "active" })
      .eq("stripe_subscription_id", subscriptionId)
      .in("status", ["past_due", "cancelled"]);

    if (error) {
      console.error("Failed to reactivate client:", error.message);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentFailed(invoice: any, supabase: any) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  // Flag the client's account
  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (!client) return;

  console.warn("Payment failed for client:", client.name, "invoice:", invoice.id);

  await supabase
    .from("clients")
    .update({ status: "past_due" })
    .eq("id", client.id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createUserRow(supabase: any, userId: string, email: string, orgId: string, clientId: string) {
  const { error } = await supabase.from("users").upsert(
    {
      id: userId,
      email,
      organization_id: orgId,
      client_id: clientId,
      role: "client_admin",
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("Failed to create user row:", error.message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setClientPermissions(supabase: any, clientId: string, plan: any) {
  // Use plan boolean columns directly instead of heuristics
  const permissions: { feature: string; enabled: boolean }[] = [
    // Base features — always enabled for all plans
    { feature: "analytics", enabled: true },
    { feature: "conversations", enabled: true },
    { feature: "leads", enabled: true },
    { feature: "phone_numbers", enabled: true },
    { feature: "workflows", enabled: true },
    // Plan-gated features — read directly from plan columns
    { feature: "topics", enabled: plan.topic_management ?? false },
    { feature: "agent_settings", enabled: (plan.raw_prompt_editor || plan.speech_settings_full) ?? false },
    { feature: "campaigns", enabled: plan.campaign_outbound ?? false },
    { feature: "knowledge_base", enabled: (plan.knowledge_bases ?? 1) > 1 },
  ];

  const rows = permissions.map((p) => ({
    client_id: clientId,
    feature: p.feature,
    enabled: p.enabled,
  }));

  const { error } = await supabase.from("client_access").upsert(rows, {
    onConflict: "client_id,feature",
  });

  if (error) {
    console.error("Failed to set client permissions:", error.message);
  }
}
