import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
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

    const organizationId = dbUser.organization_id;

    // Validate required fields
    const { name, plan_ids } = body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!Array.isArray(plan_ids) || plan_ids.length === 0) {
      return NextResponse.json({ error: "plan_ids must be a non-empty array" }, { status: 400 });
    }

    const { data, error } = await supabase.from("pricing_tables").insert({
      organization_id: organizationId,
      name: name.trim(),
      plan_ids,
      default_view: body.default_view || "monthly",
      button_shape: body.button_shape || "rounded",
      background_color: body.background_color || null,
      button_color: body.button_color || "#2563eb",
      highlight_enabled: body.highlight_enabled ?? false,
      highlight_plan_id: body.highlight_plan_id || null,
      highlight_label: body.highlight_label || "Most Popular",
      highlight_color: body.highlight_color || "#2563eb",
      badge_color: body.badge_color || "#2563eb",
      is_active: true,
    }).select().single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Pricing tables create error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
