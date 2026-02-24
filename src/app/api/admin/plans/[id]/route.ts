import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  try {
    const { id } = await params;
    const body = await request.json();

    // Look up the user's organization
    const { data: dbUser, error: userError } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user!.id)
      .single();

    if (userError || !dbUser?.organization_id) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Verify the plan belongs to this organization
    const { data: existing, error: existingError } = await supabase
      .from("client_plans")
      .select("id")
      .eq("id", id)
      .eq("organization_id", dbUser.organization_id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Remove organization_id from update payload to prevent tampering
    const { organization_id: _orgId, id: _id, ...updatePayload } = body;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { error } = await supabase
      .from("client_plans")
      .update(updatePayload)
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Plans update error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  try {
    const { id } = await params;

    // Look up the user's organization
    const { data: dbUser, error: userError } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user!.id)
      .single();

    if (userError || !dbUser?.organization_id) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Verify the plan belongs to this organization
    const { data: existing, error: existingError } = await supabase
      .from("client_plans")
      .select("id")
      .eq("id", id)
      .eq("organization_id", dbUser.organization_id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("client_plans")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Plans delete error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
