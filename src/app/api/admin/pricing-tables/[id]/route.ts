import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api/require-role";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireRole(["startup_admin"]);
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

    // Verify the pricing table belongs to this organization
    const { data: existing, error: existingError } = await supabase
      .from("pricing_tables")
      .select("id")
      .eq("id", id)
      .eq("organization_id", dbUser.organization_id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Pricing table not found" }, { status: 404 });
    }

    // Only allow updating specific fields
    const allowedFields = ["is_active", "name", "plan_ids", "default_view", "button_shape", "background_color", "button_color", "highlight_enabled", "highlight_plan_id", "highlight_label", "highlight_color", "badge_color"];
    const updatePayload: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) {
        updatePayload[key] = body[key];
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error } = await supabase
      .from("pricing_tables")
      .update(updatePayload)
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pricing tables update error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireRole(["startup_admin"]);
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

    // Verify the pricing table belongs to this organization
    const { data: existing, error: existingError } = await supabase
      .from("pricing_tables")
      .select("id")
      .eq("id", id)
      .eq("organization_id", dbUser.organization_id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: "Pricing table not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("pricing_tables")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pricing tables delete error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
