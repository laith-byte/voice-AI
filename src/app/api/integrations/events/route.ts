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
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "20", 10), 100);
  const provider = url.searchParams.get("provider");
  const offset = (page - 1) * pageSize;

  const serviceClient = await createServiceClient();

  let query = serviceClient
    .from("integration_events")
    .select("*", { count: "exact" })
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (provider) {
    query = query.eq("provider", provider);
  }

  const { data: events, count, error: queryError } = await query;

  if (queryError) {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }

  return NextResponse.json({
    events: events || [],
    total: count || 0,
    page,
    pageSize,
  });
}
