import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error } = await getClientId(user!, supabase, request);
  if (error) return error;
  if (!clientId) {
    return NextResponse.json({ error: "Client not found" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  const { data: connections, error: fetchError } = await serviceClient
    .from("oauth_connections")
    .select("id, provider, provider_email, scopes, provider_metadata, created_at, updated_at")
    .eq("client_id", clientId);

  if (fetchError) {
    return NextResponse.json({ error: "Failed to fetch connections" }, { status: 500 });
  }

  return NextResponse.json({ connections: connections || [] });
}
