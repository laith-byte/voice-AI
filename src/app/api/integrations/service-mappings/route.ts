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

  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");

  const serviceClient = await createServiceClient();

  let query = serviceClient
    .from("service_category_mappings")
    .select("*")
    .eq("client_id", clientId)
    .order("internal_service_name", { ascending: true });

  if (provider) {
    query = query.eq("provider", provider);
  }

  const { data: mappings, error: queryError } = await query;

  if (queryError) {
    return NextResponse.json({ error: "Failed to fetch mappings" }, { status: 500 });
  }

  return NextResponse.json({ mappings: mappings || [] });
}

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error } = await getClientId(user!, supabase, request);
  if (error) return error;
  if (!clientId) {
    return NextResponse.json({ error: "Client not found" }, { status: 400 });
  }

  const body = await request.json();
  const {
    provider,
    internal_service_id,
    internal_service_name,
    external_category_id,
    external_category_name,
    default_duration_minutes,
    default_price_cents,
  } = body;

  if (!provider || !internal_service_name) {
    return NextResponse.json(
      { error: "provider and internal_service_name are required" },
      { status: 400 }
    );
  }

  const serviceClient = await createServiceClient();

  const { data: mapping, error: insertError } = await serviceClient
    .from("service_category_mappings")
    .upsert(
      {
        client_id: clientId,
        provider,
        internal_service_id: internal_service_id || null,
        internal_service_name,
        external_category_id: external_category_id || null,
        external_category_name: external_category_name || null,
        default_duration_minutes: default_duration_minutes || 60,
        default_price_cents: default_price_cents || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,provider,internal_service_id" }
    )
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Failed to save mapping" }, { status: 500 });
  }

  return NextResponse.json({ mapping });
}

export async function DELETE(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error } = await getClientId(user!, supabase, request);
  if (error) return error;
  if (!clientId) {
    return NextResponse.json({ error: "Client not found" }, { status: 400 });
  }

  const url = new URL(request.url);
  const mappingId = url.searchParams.get("id");

  if (!mappingId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  const { error: deleteError } = await serviceClient
    .from("service_category_mappings")
    .delete()
    .eq("id", mappingId)
    .eq("client_id", clientId);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete mapping" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
