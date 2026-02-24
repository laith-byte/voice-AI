import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";

// PATCH — Update a client automation (enable/disable, update config)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error } = await getClientId(user!, supabase, request);
  if (error) return error;

  const body = await request.json();

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.is_enabled !== undefined) updateData.is_enabled = body.is_enabled;
  if (body.config !== undefined) updateData.config = body.config;

  const { data, error: dbError } = await supabase
    .from("client_automations")
    .update(updateData)
    .eq("id", id)
    .eq("client_id", clientId)
    .select("*, automation_recipes(*)")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ automation: data });
}

// DELETE — Remove a client automation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error } = await getClientId(user!, supabase, request);
  if (error) return error;

  const { error: dbError } = await supabase
    .from("client_automations")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
