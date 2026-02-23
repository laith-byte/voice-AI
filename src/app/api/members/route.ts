import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

/** PATCH /api/members — update a member's role */
export async function PATCH(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const body = await request.json();
  const { memberId, role } = body;

  if (!memberId || !role) {
    return NextResponse.json({ error: "memberId and role are required" }, { status: 400 });
  }

  if (!["startup_admin", "startup_member"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Verify the current user is an admin in the same org
  const { data: currentUser } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user!.id)
    .single();

  if (!currentUser?.organization_id || currentUser.role !== "startup_admin") {
    return NextResponse.json({ error: "Only admins can change roles" }, { status: 403 });
  }

  // Verify target member is in the same org
  const { data: targetUser } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", memberId)
    .single();

  if (!targetUser || targetUser.organization_id !== currentUser.organization_id) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("users")
    .update({ role })
    .eq("id", memberId);

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/** DELETE /api/members — remove a member from the organization */
export async function DELETE(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("id");

  if (!memberId) {
    return NextResponse.json({ error: "id query parameter is required" }, { status: 400 });
  }

  // Cannot remove yourself
  if (memberId === user!.id) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  // Verify the current user is an admin
  const { data: currentUser } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", user!.id)
    .single();

  if (!currentUser?.organization_id || currentUser.role !== "startup_admin") {
    return NextResponse.json({ error: "Only admins can remove members" }, { status: 403 });
  }

  // Verify target member is in the same org
  const { data: targetUser } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", memberId)
    .single();

  if (!targetUser || targetUser.organization_id !== currentUser.organization_id) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Remove the member by clearing their organization_id
  const { error } = await supabase
    .from("users")
    .update({ organization_id: null })
    .eq("id", memberId);

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
