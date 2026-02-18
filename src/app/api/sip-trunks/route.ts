import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("sip_trunks")
    .select("id, organization_id, client_id, label, sip_uri, username, codec, status, created_at, updated_at")
    .eq("organization_id", userData.organization_id)
    .neq("status", "disabled")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const body = await request.json();

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("sip_trunks")
    .insert({
      organization_id: userData.organization_id,
      client_id: body.client_id || null,
      label: body.label,
      sip_uri: body.sip_uri,
      username: body.username || null,
      password_encrypted: body.password ? encrypt(body.password) : null,
      codec: body.codec || "PCMU",
    })
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
