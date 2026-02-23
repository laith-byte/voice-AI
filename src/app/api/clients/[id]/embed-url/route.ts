import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

/** GET /api/clients/[id]/embed-url — get client's embed domain */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.organization_id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("embed_domain")
    .eq("id", id)
    .eq("organization_id", userData.organization_id)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({ embed_domain: client.embed_domain || "" });
}

/** PATCH /api/clients/[id]/embed-url — save embed domain to client */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const { embed_domain } = body;

  if (typeof embed_domain !== "string") {
    return NextResponse.json({ error: "embed_domain is required" }, { status: 400 });
  }

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.organization_id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("clients")
    .update({ embed_domain })
    .eq("id", id)
    .eq("organization_id", userData.organization_id);

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "Failed to save embed domain" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
