import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";

// GET — List client's enabled automations with recipe details
export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error } = await getClientId(user!, supabase, request);
  if (error) return error;

  const { data: automations, error: dbError } = await supabase
    .from("client_automations")
    .select("*, automation_recipes(*)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ automations: automations || [], client_id: clientId });
}

// POST — Enable a recipe for this client
export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error } = await getClientId(user!, supabase, request);
  if (error) return error;

  const body = await request.json();
  const { recipe_id, config } = body;

  if (!recipe_id) {
    return NextResponse.json({ error: "recipe_id required" }, { status: 400 });
  }

  const { data, error: dbError } = await supabase
    .from("client_automations")
    .upsert(
      {
        client_id: clientId,
        recipe_id,
        is_enabled: true,
        config: config || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,recipe_id" }
    )
    .select("*, automation_recipes(*)")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ automation: data }, { status: 201 });
}
