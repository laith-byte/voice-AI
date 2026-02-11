import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import PricingCards from "./pricing-cards";

export default async function PricingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createServiceClient();

  // Look up organization by slug
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", orgSlug)
    .single();

  if (!org) return notFound();

  // Fetch active plans for this organization, ordered by sort_order
  const { data: plans } = await supabase
    .from("client_plans")
    .select("*")
    .eq("organization_id", org.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  // Fetch stripe connection for checkout
  const { data: stripeConnection } = await supabase
    .from("stripe_connections")
    .select("stripe_account_id, is_connected")
    .eq("organization_id", org.id)
    .eq("is_connected", true)
    .single();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your business. All plans include a one-time setup fee.
          </p>
        </div>

        <PricingCards
          plans={plans || []}
          orgSlug={orgSlug}
          stripeAccountId={stripeConnection?.stripe_account_id || null}
        />

        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            All prices in USD. Cancel anytime. Need a custom plan?{" "}
            <a href="#" className="text-blue-600 hover:underline">Contact us</a>
          </p>
        </div>
      </div>
    </div>
  );
}
