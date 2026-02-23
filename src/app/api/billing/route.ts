import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const stripeLib = await import("@/lib/stripe");
  const body = await request.json();
  const { action, stripeAccountId } = body;

  // Validate stripeAccountId belongs to the user's organization
  if (stripeAccountId) {
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user!.id)
      .single();
    if (!userData?.organization_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const { data: conn } = await supabase
      .from("stripe_connections")
      .select("stripe_account_id")
      .eq("organization_id", userData.organization_id)
      .eq("stripe_account_id", stripeAccountId)
      .single();
    if (!conn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  // Actions that require a connected account
  const requiresAccount = ["list_products", "create_product", "list_subscriptions", "list_invoices", "list_charges", "create_coupon", "list_coupons", "create_checkout", "cancel_subscription", "create_invoice", "list_customers"];
  if (requiresAccount.includes(action) && !stripeAccountId) {
    return NextResponse.json({ error: "stripeAccountId is required for this action" }, { status: 400 });
  }

  try {
    switch (action) {
      case "create_connect_account": {
        const account = await stripeLib.createConnectAccount(body.email);
        const link = await stripeLib.createAccountLink(
          account.id,
          `${process.env.NEXT_PUBLIC_APP_URL}/billing/connect?connected=true`,
          `${process.env.NEXT_PUBLIC_APP_URL}/billing/connect?refresh=true`
        );
        return NextResponse.json({ accountId: account.id, url: link.url });
      }

      case "create_account_link": {
        if (!stripeAccountId) {
          return NextResponse.json({ error: "stripeAccountId is required" }, { status: 400 });
        }
        const link = await stripeLib.createAccountLink(
          stripeAccountId,
          `${process.env.NEXT_PUBLIC_APP_URL}/billing/connect?connected=true`,
          `${process.env.NEXT_PUBLIC_APP_URL}/billing/connect?refresh=true`
        );
        return NextResponse.json({ url: link.url });
      }

      case "list_products": {
        const products = await stripeLib.listProducts(stripeAccountId);
        return NextResponse.json(products.data);
      }

      case "create_product": {
        const product = await stripeLib.createProduct(
          { name: body.name, description: body.description },
          stripeAccountId
        );
        if (body.price) {
          await stripeLib.createPrice(
            {
              product: product.id,
              unit_amount: Math.round(body.price * 100),
              currency: "usd",
              recurring: { interval: "month" },
            },
            stripeAccountId
          );
        }
        return NextResponse.json(product);
      }

      case "list_subscriptions": {
        const subs = await stripeLib.listSubscriptions(stripeAccountId);
        return NextResponse.json(subs.data);
      }

      case "list_invoices": {
        const invoices = await stripeLib.listInvoices(stripeAccountId);
        return NextResponse.json(invoices.data);
      }

      case "list_charges": {
        const charges = await stripeLib.listCharges(stripeAccountId);
        return NextResponse.json(charges.data);
      }

      case "create_coupon": {
        const coupon = await stripeLib.createCoupon(
          {
            percent_off: body.percent_off,
            amount_off: body.amount_off ? Math.round(body.amount_off * 100) : undefined,
            currency: body.amount_off ? "usd" : undefined,
            duration: body.duration || "once",
            id: body.code,
          },
          stripeAccountId
        );
        return NextResponse.json(coupon);
      }

      case "list_coupons": {
        const coupons = await stripeLib.listCoupons(stripeAccountId);
        return NextResponse.json(coupons.data);
      }

      case "create_checkout": {
        const session = await stripeLib.createCheckoutSession(
          {
            mode: "subscription",
            line_items: body.line_items,
            success_url: body.success_url,
            cancel_url: body.cancel_url,
            customer_email: body.customer_email,
          },
          stripeAccountId
        );
        return NextResponse.json({ url: session.url });
      }

      case "cancel_subscription": {
        if (!body.subscriptionId) {
          return NextResponse.json({ error: "subscriptionId is required" }, { status: 400 });
        }
        const updated = await stripeLib.cancelSubscription(body.subscriptionId, stripeAccountId);
        return NextResponse.json(updated);
      }

      case "create_invoice": {
        if (!body.customerId || !body.amount) {
          return NextResponse.json({ error: "customerId and amount are required" }, { status: 400 });
        }
        const invoice = await stripeLib.createInvoice(
          {
            customer: body.customerId,
            collection_method: "send_invoice",
            days_until_due: 30,
            description: body.description || undefined,
          },
          stripeAccountId
        );
        await stripeLib.createInvoiceItem(
          {
            customer: body.customerId,
            amount: Math.round(body.amount * 100),
            currency: "usd",
            invoice: invoice.id,
            description: body.description || "Invoice item",
          },
          stripeAccountId
        );
        const sent = await stripeLib.sendInvoice(invoice.id, stripeAccountId);
        return NextResponse.json(sent);
      }

      case "list_customers": {
        const customers = await stripeLib.listCustomers(stripeAccountId);
        return NextResponse.json(customers.data);
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Billing error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
