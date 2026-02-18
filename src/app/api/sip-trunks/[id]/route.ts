import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { encrypt } from "@/lib/crypto";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;

  const { data, error } = await supabase
    .from("sip_trunks")
    .select("id, organization_id, client_id, label, sip_uri, username, codec, status, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "SIP trunk not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();

  // Strip unsafe keys
  const { id: _id, organization_id: _oid, created_at: _ca, ...safeBody } = body;

  // Encrypt password if provided
  if (safeBody.password) {
    safeBody.password_encrypted = encrypt(safeBody.password);
    delete safeBody.password;
  }

  const { data, error } = await supabase
    .from("sip_trunks")
    .update({ ...safeBody, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;

  // Soft delete — set status to disabled
  const { error } = await supabase
    .from("sip_trunks")
    .update({ status: "disabled", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
