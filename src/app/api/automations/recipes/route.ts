import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

// GET — List all recipes for the org (admin) or available recipes (client)
export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("role, organization_id, client_id")
    .eq("id", user!.id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let query = supabase
    .from("automation_recipes")
    .select("*")
    .order("sort_order", { ascending: true });

  if (userData.role?.startsWith("startup_")) {
    query = query.eq("organization_id", userData.organization_id);
  }
  // For client users, RLS handles filtering to their org's recipes

  const { data: recipes, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ recipes: recipes || [] });
}

// POST — Create a new recipe (admin only)
export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("role, organization_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.role?.startsWith("startup_")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();

  const { data, error } = await supabase
    .from("automation_recipes")
    .insert({
      organization_id: userData.organization_id,
      name: body.name,
      description: body.description || null,
      long_description: body.long_description || null,
      icon: body.icon || null,
      category: body.category || "general",
      n8n_webhook_url: body.n8n_webhook_url,
      n8n_workflow_id: body.n8n_workflow_id || null,
      config_schema: body.config_schema || [],
      what_gets_sent: body.what_gets_sent || null,
      is_active: body.is_active ?? true,
      is_coming_soon: body.is_coming_soon ?? false,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ recipe: data }, { status: 201 });
}
