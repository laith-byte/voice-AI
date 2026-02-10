import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agents")
    .select("*, clients(name)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
