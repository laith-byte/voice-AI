import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

export async function GET() {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data, error } = await supabase
    .from("agents")
    .select("*, clients(name)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const body = await request.json();

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await supabase.from("agents").insert({
    organization_id: userData.organization_id,
    name: body.name,
    description: body.description || null,
    platform: body.platform || "retell",
    retell_agent_id: body.retell_agent_id,
    retell_api_key_encrypted: body.retell_api_key_encrypted,
    knowledge_base_id: body.knowledge_base_id || null,
    knowledge_base_name: body.knowledge_base_name || null,
    client_id: body.client_id || null,
    webhook_url: body.webhook_url || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
