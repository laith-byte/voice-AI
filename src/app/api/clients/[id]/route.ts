import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { logger } from "@/lib/logger";

/** PATCH /api/clients/[id] — Update client information */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  // Verify the user belongs to the same org as the client
  const { data: userData } = await supabase
    .from("users")
    .select("role, organization_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.role?.startsWith("startup_")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("organization_id")
    .eq("id", id)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (client.organization_id !== userData.organization_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // Allowlist safe columns
  const ALLOWED_FIELDS = ["name", "slug", "status", "language", "dashboard_theme"];
  const safeUpdate: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) safeUpdate[key] = body[key];
  }

  if (Object.keys(safeUpdate).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Validate status if provided
  if (safeUpdate.status && !["active", "inactive", "suspended"].includes(safeUpdate.status as string)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("clients")
    .update(safeUpdate)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("Failed to update client", { error: error.message, clientId: id });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}
