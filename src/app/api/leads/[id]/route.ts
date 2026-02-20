import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

const ALLOWED_FIELDS = new Set(["name", "tags", "dynamic_vars", "phone"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id } = await params;
  const body = await request.json();

  // Only allow safe fields
  const safeBody: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key)) safeBody[key] = body[key];
  }

  if (Object.keys(safeBody).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("leads")
    .update(safeBody)
    .eq("id", id)
    .eq("organization_id", userData.organization_id)
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id } = await params;

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("organization_id", userData.organization_id);

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
