import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { encrypt } from "@/lib/crypto";

/** PATCH /api/integrations/configure — update an integration's API key */
export async function PATCH(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const body = await request.json();
  const { integrationId, api_key } = body;

  if (!integrationId || !api_key) {
    return NextResponse.json({ error: "integrationId and api_key are required" }, { status: 400 });
  }

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.organization_id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify integration belongs to user's org
  const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("id", integrationId)
    .eq("organization_id", userData.organization_id)
    .single();

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("integrations")
    .update({ api_key_encrypted: encrypt(api_key) })
    .eq("id", integrationId);

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "Failed to update integration" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
