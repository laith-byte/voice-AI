import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

// PATCH — Update a recipe (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (!userData?.role?.startsWith("startup_")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fields = [
    "name", "description", "long_description", "icon", "category",
    "n8n_webhook_url", "n8n_workflow_id", "config_schema", "what_gets_sent",
    "is_active", "is_coming_soon", "sort_order",
  ];
  for (const field of fields) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }

  const { data, error } = await supabase
    .from("automation_recipes")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ recipe: data });
}

// DELETE — Delete a recipe (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (!userData?.role?.startsWith("startup_")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { error } = await supabase
    .from("automation_recipes")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
