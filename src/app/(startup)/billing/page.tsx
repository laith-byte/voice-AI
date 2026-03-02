import { redirect } from "next/navigation";

/**
 * Redirect /billing to /billing/connect so dashboard "Manage Billing" link works.
 * Avoids 404 (or prefetch 400) when Next.js resolves /billing.
 */
export default function BillingIndexPage() {
  redirect("/billing/connect");
}
