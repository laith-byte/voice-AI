import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import PricingCards from "./pricing-cards";
import type { PlanAddon } from "@/types/database";

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

  // Fetch add-ons
  const { data: addons } = await supabase
    .from("plan_addons")
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
    <PricingCards
      plans={plans || []}
      addons={(addons as PlanAddon[]) || []}
      orgSlug={orgSlug}
      stripeAccountId={stripeConnection?.stripe_account_id || null}
    />
  );
}
