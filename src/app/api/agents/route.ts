import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data, error } = await supabase
    .from("agents")
    .select("id, name, description, platform, retell_agent_id, knowledge_base_id, knowledge_base_name, webhook_url, organization_id, client_id, created_at, updated_at, clients(name)")
    .order("created_at", { ascending: false });
  if (error) { console.error("DB error:", error.message); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const body = await request.json();

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user!.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await supabase.from("agents").insert({
    organization_id: userData.organization_id,
    name: body.name,
    description: body.description || null,
    platform: body.platform || "retell",
    retell_agent_id: body.retell_agent_id,
    retell_api_key_encrypted: (body.retell_api_key || body.retell_api_key_encrypted) ? encrypt(body.retell_api_key || body.retell_api_key_encrypted) : null,
    knowledge_base_id: body.knowledge_base_id || null,
    knowledge_base_name: body.knowledge_base_name || null,
    client_id: body.client_id || null,
    webhook_url: body.webhook_url || null,
  }).select().single();

  if (error) { console.error("DB error:", error.message); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}
