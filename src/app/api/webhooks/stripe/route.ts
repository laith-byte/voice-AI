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

async function sendWelcomeEmail(to: string, businessName: string, actionLink: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.invarialabs.com";

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
