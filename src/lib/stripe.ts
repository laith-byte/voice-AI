import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, {
    apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion,
    typescript: true,
  });
}

export async function createConnectAccount(email: string) {
  return getStripe().accounts.create({ type: "standard", email });
}

export async function createAccountLink(accountId: string, returnUrl: string, refreshUrl: string) {
  return getStripe().accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: "account_onboarding",
  });
}

export async function createProduct(params: Stripe.ProductCreateParams, stripeAccountId?: string) {
  return getStripe().products.create(params, stripeAccountId ? { stripeAccount: stripeAccountId } : undefined);
}

export async function listProducts(stripeAccountId?: string) {
  return getStripe().products.list({ limit: 100 }, stripeAccountId ? { stripeAccount: stripeAccountId } : undefined);
}

export async function createPrice(params: Stripe.PriceCreateParams, stripeAccountId?: string) {
  return getStripe().prices.create(params, stripeAccountId ? { stripeAccount: stripeAccountId } : undefined);
}

export async function createCheckoutSession(params: Stripe.Checkout.SessionCreateParams, stripeAccountId?: string) {
  return getStripe().checkout.sessions.create(params, stripeAccountId ? { stripeAccount: stripeAccountId } : undefined);
}

export async function listSubscriptions(stripeAccountId?: string, customerId?: string) {
  return getStripe().subscriptions.list(
    { limit: 100, ...(customerId ? { customer: customerId } : {}) },
    stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
  );
}

export async function listInvoices(stripeAccountId?: string, customerId?: string) {
  return getStripe().invoices.list(
    { limit: 100, ...(customerId ? { customer: customerId } : {}) },
    stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
  );
}

export async function listCharges(stripeAccountId?: string) {
  return getStripe().charges.list(
    { limit: 100 },
    stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
  );
}

export async function createCoupon(params: Stripe.CouponCreateParams, stripeAccountId?: string) {
  return getStripe().coupons.create(params, stripeAccountId ? { stripeAccount: stripeAccountId } : undefined);
}

export async function listCoupons(stripeAccountId?: string) {
  return getStripe().coupons.list(
    { limit: 100 },
    stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
  );
}

export function constructWebhookEvent(payload: string | Buffer, sig: string, secret: string) {
  return getStripe().webhooks.constructEvent(payload, sig, secret);
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string,
  stripeAccountId?: string
) {
  return getStripe().billingPortal.sessions.create(
    { customer: customerId, return_url: returnUrl },
    stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
  );
}

export async function retrieveSubscription(subscriptionId: string, stripeAccountId?: string) {
  return getStripe().subscriptions.retrieve(
    subscriptionId,
    { expand: ["default_payment_method"] },
    stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
  );
}
