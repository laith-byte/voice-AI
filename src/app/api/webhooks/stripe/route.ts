import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";

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
    case "invoice.paid": {
      await handleInvoicePaid(event.data.object, supabase);
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

  // 4. Create auth user and generate invite link (without sending Supabase's default email)
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "invite",
    email: customerEmail,
    options: {
      data: {
        role: "client_admin",
        full_name: clientName,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/setup-account`,
    },
  });

  if (linkError) {
    console.error("Failed to generate invite link:", linkError.message);
    // Try to see if user already exists in auth
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existingAuthUser = users?.find((u: { email?: string }) => u.email === customerEmail);
    if (existingAuthUser) {
      // User exists in auth but not linked to a client — create the users row
      await createUserRow(supabase, existingAuthUser.id, customerEmail, organization_id, client.id);
    } else {
      return;
    }
  } else if (linkData?.user) {
    // 5. Create users table row
    await createUserRow(supabase, linkData.user.id, customerEmail, organization_id, client.id);

    // 6. Send custom branded invite email via Resend
    const actionLink = linkData.properties?.action_link;
    if (actionLink) {
      await sendWelcomeEmail(customerEmail, clientName, actionLink);
    } else {
      console.error("No action_link returned from generateLink");
    }
  }

  // 7. Set client_access permissions based on plan
  await setClientPermissions(supabase, client.id, plan);

  // 8. Create client_onboarding record
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
      name: email.split("@")[0] || "New User",
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
    agent_id: null,
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

async function sendWelcomeEmail(to: string, businessName: string, actionLink: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  try {
    await sendEmail({
      to,
      subject: "Welcome to Invaria Labs — Set Up Your Account",
      from: "Invaria Labs <noreply@invarialabs.com>",
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:32px;">
          <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Invaria Labs</span>
        </td></tr>
        <!-- Card -->
        <tr><td style="background-color:#1e293b;border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:48px 40px;">
          <!-- Check icon -->
          <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-block;width:48px;height:48px;background-color:#059669;border-radius:12px;line-height:48px;text-align:center;">
              <span style="color:#ffffff;font-size:24px;">&#10003;</span>
            </div>
          </div>
          <!-- Heading -->
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;text-align:center;">
            Your Subscription is Confirmed
          </h1>
          <p style="margin:0 0 32px;font-size:14px;color:rgba(255,255,255,0.6);text-align:center;">
            Welcome, ${escapeHtml(businessName)}! Your AI phone agent platform is ready.
          </p>
          <!-- Divider -->
          <div style="border-top:1px solid rgba(255,255,255,0.1);margin:0 0 32px;"></div>
          <!-- Body -->
          <p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.8);line-height:1.6;">
            To get started, click the button below to set up your account. You'll choose a password and confirm your business name, then you'll have full access to your portal.
          </p>
          <p style="margin:0 0 32px;font-size:15px;color:rgba(255,255,255,0.8);line-height:1.6;">
            Here's what you can do once you're in:
          </p>
          <ul style="margin:0 0 32px;padding-left:20px;font-size:14px;color:rgba(255,255,255,0.7);line-height:2;">
            <li>Configure your AI phone agent</li>
            <li>Upload your knowledge base</li>
            <li>Set up call routing and phone numbers</li>
            <li>Monitor live conversations and analytics</li>
          </ul>
          <!-- CTA Button -->
          <div style="text-align:center;margin-bottom:32px;">
            <a href="${actionLink}" style="display:inline-block;padding:14px 40px;background-color:#2563eb;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:10px;">
              Set Up Your Account
            </a>
          </div>
          <!-- Divider -->
          <div style="border-top:1px solid rgba(255,255,255,0.1);margin:0 0 24px;"></div>
          <!-- Security note -->
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-align:center;line-height:1.5;">
            This link expires in 24 hours. If you didn't sign up for Invaria Labs, you can safely ignore this email.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding-top:32px;text-align:center;">
          <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.3);">
            Invaria Labs &mdash; AI-Powered Phone Agents
          </p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
            ${appUrl.replace(/^https?:\/\//, "")}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
    console.log("Welcome email sent to:", to);
  } catch (err) {
    console.error("Failed to send welcome email:", err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleInvoicePaid(invoice: any, supabase: any) {
  const subscriptionId = invoice.subscription;
  const customerEmail = invoice.customer_email;

  if (!subscriptionId || !customerEmail) {
    console.log("Invoice paid but no subscription or email — skipping receipt:", invoice.id);
    return;
  }

  // Skip the very first invoice created at checkout (billing_reason = "subscription_create")
  // because the client just received a welcome email
  if (invoice.billing_reason === "subscription_create") {
    console.log("Skipping receipt for initial subscription invoice:", invoice.id);
    return;
  }

  // Find the client with this subscription
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, slug, plan_id, organization_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (!client) {
    console.log("No client found for paid invoice subscription:", subscriptionId);
    return;
  }

  // Get the client's plan details
  let planName = "Your Plan";
  let planDetails: { agents: number; minutes: number; phoneNumbers: number } | null = null;
  if (client.plan_id) {
    const { data: plan } = await supabase
      .from("client_plans")
      .select("name, agents_included, call_minutes_included, phone_numbers_included")
      .eq("id", client.plan_id)
      .single();
    if (plan) {
      planName = plan.name;
      planDetails = {
        agents: plan.agents_included ?? 1,
        minutes: plan.call_minutes_included ?? 0,
        phoneNumbers: plan.phone_numbers_included ?? 1,
      };
    }
  }

  // Get client's active add-ons
  const { data: clientAddons } = await supabase
    .from("client_addons")
    .select("quantity, plan_addons(name, monthly_price, one_time_price, addon_type)")
    .eq("client_id", client.id)
    .eq("status", "active");

  // Build line items from the Stripe invoice
  const lineItems: { description: string; amount: string }[] = [];
  if (invoice.lines?.data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const line of invoice.lines.data as any[]) {
      const desc = line.description || line.price?.product?.name || planName;
      const amt = (line.amount ?? 0) / 100;
      lineItems.push({
        description: desc,
        amount: `$${amt.toFixed(2)}`,
      });
    }
  }

  // If no line items from Stripe, use the invoice total
  if (lineItems.length === 0) {
    lineItems.push({
      description: `${planName} — Monthly Subscription`,
      amount: `$${((invoice.amount_paid ?? invoice.amount_due ?? 0) / 100).toFixed(2)}`,
    });
  }

  // Add add-on details if the platform has them (informational, they may already be in Stripe line items)
  // These are appended as context but won't duplicate Stripe's actual charges

  const totalAmount = ((invoice.amount_paid ?? invoice.amount_due ?? 0) / 100).toFixed(2);
  const invoiceDate = new Date((invoice.created ?? Math.floor(Date.now() / 1000)) * 1000);
  const periodStart = invoice.period_start
    ? new Date(invoice.period_start * 1000)
    : invoice.lines?.data?.[0]?.period?.start
    ? new Date(invoice.lines.data[0].period.start * 1000)
    : null;
  const periodEnd = invoice.period_end
    ? new Date(invoice.period_end * 1000)
    : invoice.lines?.data?.[0]?.period?.end
    ? new Date(invoice.lines.data[0].period.end * 1000)
    : null;

  await sendReceiptEmail({
    to: customerEmail,
    clientName: client.name,
    planName,
    planDetails,
    addons: clientAddons || [],
    lineItems,
    totalAmount: `$${totalAmount}`,
    invoiceDate: invoiceDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    billingPeriod:
      periodStart && periodEnd
        ? `${periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${periodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : null,
    invoiceNumber: invoice.number || invoice.id,
    invoicePdfUrl: invoice.invoice_pdf || null,
    hostedInvoiceUrl: invoice.hosted_invoice_url || null,
    portalUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/${client.slug}/portal/billing`,
  });

  console.log("Receipt email sent for invoice:", invoice.id, "to:", customerEmail);
}

interface ReceiptEmailParams {
  to: string;
  clientName: string;
  planName: string;
  planDetails: { agents: number; minutes: number; phoneNumbers: number } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addons: any[];
  lineItems: { description: string; amount: string }[];
  totalAmount: string;
  invoiceDate: string;
  billingPeriod: string | null;
  invoiceNumber: string;
  invoicePdfUrl: string | null;
  hostedInvoiceUrl: string | null;
  portalUrl: string;
}

async function sendReceiptEmail(params: ReceiptEmailParams) {
  const {
    to,
    clientName,
    planName,
    planDetails,
    addons,
    lineItems,
    totalAmount,
    invoiceDate,
    billingPeriod,
    invoiceNumber,
    invoicePdfUrl,
    hostedInvoiceUrl,
    portalUrl,
  } = params;

  // Build line items HTML
  const lineItemsHtml = lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;font-size:14px;color:rgba(255,255,255,0.8);border-bottom:1px solid rgba(255,255,255,0.06);">
          ${escapeHtml(item.description)}
        </td>
        <td style="padding:10px 0;font-size:14px;color:#ffffff;text-align:right;font-weight:500;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap;">
          ${escapeHtml(item.amount)}
        </td>
      </tr>`
    )
    .join("");

  // Build plan details HTML if available
  let planIncludesHtml = "";
  if (planDetails) {
    planIncludesHtml = `
      <div style="margin-top:24px;padding:16px;background-color:rgba(37,99,235,0.1);border-radius:10px;border:1px solid rgba(37,99,235,0.2);">
        <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px;">Plan Includes</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:rgba(255,255,255,0.7);padding:3px 0;">${planDetails.agents} AI Agent${planDetails.agents !== 1 ? "s" : ""}</td>
            <td style="font-size:13px;color:rgba(255,255,255,0.7);padding:3px 0;text-align:center;">${planDetails.minutes.toLocaleString()} min/mo</td>
            <td style="font-size:13px;color:rgba(255,255,255,0.7);padding:3px 0;text-align:right;">${planDetails.phoneNumbers} Phone Number${planDetails.phoneNumbers !== 1 ? "s" : ""}</td>
          </tr>
        </table>
      </div>`;
  }

  // Build add-ons HTML if any
  let addonsHtml = "";
  if (addons.length > 0) {
    const addonRows = addons
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a: any) => {
        const addon = a.plan_addons;
        if (!addon) return "";
        const qty = a.quantity > 1 ? ` x${a.quantity}` : "";
        return `<li style="font-size:13px;color:rgba(255,255,255,0.7);padding:2px 0;">${escapeHtml(addon.name)}${qty}</li>`;
      })
      .filter(Boolean)
      .join("");
    if (addonRows) {
      addonsHtml = `
        <div style="margin-top:16px;padding:16px;background-color:rgba(139,92,246,0.1);border-radius:10px;border:1px solid rgba(139,92,246,0.2);">
          <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px;">Active Add-ons</p>
          <ul style="margin:0;padding-left:16px;">${addonRows}</ul>
        </div>`;
    }
  }

  // Build CTA buttons
  let ctaButtons = `
    <div style="text-align:center;margin:32px 0 16px;">
      <a href="${portalUrl}" style="display:inline-block;padding:12px 32px;background-color:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
        View Billing Dashboard
      </a>
    </div>`;
  if (invoicePdfUrl || hostedInvoiceUrl) {
    const url = hostedInvoiceUrl || invoicePdfUrl;
    ctaButtons += `
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${url}" style="font-size:13px;color:#60a5fa;text-decoration:underline;">
        Download Invoice PDF
      </a>
    </div>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:32px;">
          <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Invaria Labs</span>
        </td></tr>
        <!-- Card -->
        <tr><td style="background-color:#1e293b;border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:48px 40px;">
          <!-- Receipt icon -->
          <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-block;width:48px;height:48px;background-color:#2563eb;border-radius:12px;line-height:48px;text-align:center;">
              <span style="color:#ffffff;font-size:22px;">&#9993;</span>
            </div>
          </div>
          <!-- Heading -->
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;text-align:center;">
            Payment Receipt
          </h1>
          <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.6);text-align:center;">
            Thank you, ${escapeHtml(clientName)}! Here's your receipt for ${escapeHtml(invoiceDate)}.
          </p>

          <!-- Invoice meta -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="font-size:12px;color:rgba(255,255,255,0.4);padding:4px 0;">Invoice</td>
              <td style="font-size:12px;color:rgba(255,255,255,0.7);text-align:right;padding:4px 0;">${escapeHtml(invoiceNumber)}</td>
            </tr>
            <tr>
              <td style="font-size:12px;color:rgba(255,255,255,0.4);padding:4px 0;">Plan</td>
              <td style="font-size:12px;color:rgba(255,255,255,0.7);text-align:right;padding:4px 0;">${escapeHtml(planName)}</td>
            </tr>
            ${billingPeriod ? `<tr>
              <td style="font-size:12px;color:rgba(255,255,255,0.4);padding:4px 0;">Billing Period</td>
              <td style="font-size:12px;color:rgba(255,255,255,0.7);text-align:right;padding:4px 0;">${escapeHtml(billingPeriod)}</td>
            </tr>` : ""}
          </table>

          <!-- Divider -->
          <div style="border-top:1px solid rgba(255,255,255,0.1);margin:0 0 20px;"></div>

          <!-- Line items -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">Description</td>
              <td style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;text-align:right;">Amount</td>
            </tr>
            ${lineItemsHtml}
          </table>

          <!-- Total -->
          <div style="border-top:2px solid rgba(255,255,255,0.15);margin-top:4px;padding-top:12px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:16px;font-weight:700;color:#ffffff;">Total Paid</td>
                <td style="font-size:16px;font-weight:700;color:#10b981;text-align:right;">${escapeHtml(totalAmount)}</td>
              </tr>
            </table>
          </div>

          <!-- Plan includes -->
          ${planIncludesHtml}

          <!-- Active add-ons -->
          ${addonsHtml}

          <!-- CTA Buttons -->
          ${ctaButtons}

          <!-- Divider -->
          <div style="border-top:1px solid rgba(255,255,255,0.1);margin:0 0 16px;"></div>

          <!-- Footer note -->
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);text-align:center;line-height:1.5;">
            This is an automated receipt from Invaria Labs. If you have questions about this charge, please contact your account manager or reply to this email.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding-top:32px;text-align:center;">
          <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.3);">
            Invaria Labs &mdash; AI-Powered Phone Agents
          </p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
            ${(process.env.NEXT_PUBLIC_APP_URL || "").replace(/^https?:\/\//, "")}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await sendEmail({
      to,
      subject: `Payment Receipt — ${planName} (${invoiceDate})`,
      from: "Invaria Labs <billing@invarialabs.com>",
      html,
    });
  } catch (err) {
    console.error("Failed to send receipt email:", err);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
