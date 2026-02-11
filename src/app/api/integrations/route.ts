import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { encrypt } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const body = await request.json();
  const { provider, name, api_key } = body;

  if (!provider || !name || !api_key) {
    return NextResponse.json({ error: "provider, name, and api_key are required" }, { status: 400 });
  }

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user!.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await supabase.from("integrations").insert({
    organization_id: userData.organization_id,
    provider,
    name,
    api_key_encrypted: encrypt(api_key),
    is_connected: true,
    connected_at: new Date().toISOString(),
  }).select("id, organization_id, provider, name, is_connected, connected_at").single();

  if (error) { console.error("DB error:", error.message); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id query parameter is required" }, { status: 400 });
  }

  const { error } = await supabase.from("integrations").delete().eq("id", id);
  if (error) { console.error("DB error:", error.message); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json({ success: true });
}
