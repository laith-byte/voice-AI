import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api/require-role";

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireRole(["startup_admin"]);
  if (response) return response;

  try {
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

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // Build the payload with organization_id from the server
    const payload = { ...body, organization_id: dbUser.organization_id };

    const { data, error } = await supabase
      .from("client_plans")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Plans create error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
