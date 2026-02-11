import { createServiceClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

/**
 * Fetch and decrypt an integration API key for a given organization and provider.
 * Returns null if no connected integration is found.
 */
export async function getIntegrationKey(
  organizationId: string,
  provider: string
): Promise<string | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("integrations")
    .select("api_key_encrypted")
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .eq("is_connected", true)
    .limit(1)
    .single();

  if (error || !data?.api_key_encrypted) return null;

  return decrypt(data.api_key_encrypted);
}
