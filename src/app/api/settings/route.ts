import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { encrypt } from "@/lib/crypto";

export async function PATCH(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const body = await request.json();

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user!.id)
    .single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const orgId = userData.organization_id;

  // Handle organization name update
  if (body.organization_name !== undefined) {
    const { error: orgError } = await supabase
      .from("organizations")
      .update({ name: body.organization_name })
      .eq("id", orgId);
    if (orgError) {
      console.error("DB error:", orgError.message);
      return NextResponse.json({ error: "Failed to update organization name" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // Handle organization_settings updates
  const update: Record<string, unknown> = {};

  if (body.openai_api_key !== undefined) {
    update.openai_api_key_encrypted = body.openai_api_key
      ? encrypt(body.openai_api_key)
      : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("organization_settings")
    .update(update)
    .eq("organization_id", orgId);

  if (error) { console.error("DB error:", error.message); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json({ success: true });
}
