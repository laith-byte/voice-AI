import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { logger } from "@/lib/logger";

/** DELETE /api/clients/[id]/members/[memberId] — Remove a member from a client */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id: clientId, memberId } = await params;
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  // Verify admin role
  const { data: userData } = await supabase
    .from("users")
    .select("role, organization_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.role?.startsWith("startup_")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // Verify the member belongs to this client and same org
  const { data: member } = await supabase
    .from("users")
    .select("id, client_id")
    .eq("id", memberId)
    .eq("client_id", clientId)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Member not found for this client" }, { status: 404 });
  }

  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", memberId);

  if (error) {
    logger.error("Failed to remove member", { error: error.message, memberId, clientId });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/** PATCH /api/clients/[id]/members/[memberId] — Update a member (e.g. reset onboarding) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id: clientId, memberId } = await params;
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  // Verify admin role
  const { data: userData } = await supabase
    .from("users")
    .select("role, organization_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.role?.startsWith("startup_")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // Verify the member belongs to this client
  const { data: member } = await supabase
    .from("users")
    .select("id, client_id")
    .eq("id", memberId)
    .eq("client_id", clientId)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Member not found for this client" }, { status: 404 });
  }

  const body = await request.json();

  // Allowlist safe columns
  const ALLOWED_FIELDS = ["onboarding_completed_at"];
  const safeUpdate: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) safeUpdate[key] = body[key];
  }

  if (Object.keys(safeUpdate).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("users")
    .update(safeUpdate)
    .eq("id", memberId)
    .select()
    .single();

  if (error) {
    logger.error("Failed to update member", { error: error.message, memberId, clientId });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}
