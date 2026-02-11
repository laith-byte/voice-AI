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

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Billing error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
