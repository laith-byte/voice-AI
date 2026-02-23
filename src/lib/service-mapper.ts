import { createServiceClient } from "@/lib/supabase/server";

interface ServiceMapping {
  external_category_id: string | null;
  external_category_name: string | null;
  default_duration_minutes: number;
  default_price_cents: number | null;
}

/**
 * Map a service description to a CRM category using service_category_mappings.
 * Tries exact match first, then fuzzy match on service name.
 */
export async function mapServiceToCategory(
  clientId: string,
  provider: string,
  serviceRequested: string | null
): Promise<ServiceMapping | null> {
  if (!serviceRequested) return null;

  const supabase = await createServiceClient();

  // Fetch all mappings for this client+provider
  const { data: mappings } = await supabase
    .from("service_category_mappings")
    .select("internal_service_name, external_category_id, external_category_name, default_duration_minutes, default_price_cents")
    .eq("client_id", clientId)
    .eq("provider", provider);

  if (!mappings || mappings.length === 0) return null;

  const needle = serviceRequested.toLowerCase().trim();

  // Exact match
  const exact = mappings.find(
    (m) => m.internal_service_name.toLowerCase().trim() === needle
  );
  if (exact) {
    return {
      external_category_id: exact.external_category_id,
      external_category_name: exact.external_category_name,
      default_duration_minutes: exact.default_duration_minutes ?? 60,
      default_price_cents: exact.default_price_cents,
    };
  }

  // Fuzzy match: check if any mapping name is contained in the service request or vice versa
  const fuzzy = mappings.find((m) => {
    const name = m.internal_service_name.toLowerCase().trim();
    return needle.includes(name) || name.includes(needle);
  });
  if (fuzzy) {
    return {
      external_category_id: fuzzy.external_category_id,
      external_category_name: fuzzy.external_category_name,
      default_duration_minutes: fuzzy.default_duration_minutes ?? 60,
      default_price_cents: fuzzy.default_price_cents,
    };
  }

  return null;
}
