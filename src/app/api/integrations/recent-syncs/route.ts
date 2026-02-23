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

  const { data: events, error: queryError } = await serviceClient
    .from("integration_events")
    .select("id, provider, event_type, direction, entity_type, entity_id, status, error_message, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (queryError) {
    return NextResponse.json({ error: "Failed to fetch recent syncs" }, { status: 500 });
  }

  return NextResponse.json({ events: events || [] });
}
