/**
 * Script to add the `invoice.paid` event to the existing Stripe webhook endpoint.
 *
 * Usage:
 *   npx tsx scripts/add-invoice-paid-webhook.ts
 *
 * Requires STRIPE_SECRET_KEY in .env.local
 */

import Stripe from "stripe";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env.local") });

const REQUIRED_EVENT: Stripe.WebhookEndpointUpdateParams.EnabledEvent = "invoice.paid";

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error("STRIPE_SECRET_KEY not found in .env.local");
    process.exit(1);
  }

  const stripe = new Stripe(secretKey);

  // List all webhook endpoints
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });

  if (endpoints.data.length === 0) {
    console.error("No webhook endpoints found in your Stripe account.");
    process.exit(1);
  }

  let updated = false;

  for (const endpoint of endpoints.data) {
    const events = endpoint.enabled_events || [];

    if (events.includes("*")) {
      console.log(
        `Endpoint ${endpoint.id} (${endpoint.url}) listens to all events (*) — invoice.paid is already covered.`
      );
      updated = true;
      continue;
    }

    if (events.includes(REQUIRED_EVENT)) {
      console.log(
        `Endpoint ${endpoint.id} (${endpoint.url}) already has ${REQUIRED_EVENT} enabled.`
      );
      updated = true;
      continue;
    }

    // Add invoice.paid to the existing events
    const newEvents = [...events, REQUIRED_EVENT] as Stripe.WebhookEndpointUpdateParams.EnabledEvent[];

    await stripe.webhookEndpoints.update(endpoint.id, {
      enabled_events: newEvents,
    });

    console.log(
      `Added ${REQUIRED_EVENT} to endpoint ${endpoint.id} (${endpoint.url}).`
    );
    console.log(`Enabled events: ${newEvents.join(", ")}`);
    updated = true;
  }

  if (!updated) {
    console.log("No matching endpoints were updated.");
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
