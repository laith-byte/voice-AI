import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  let query = supabase.from("leads").select("*").order("created_at", { ascending: false });
  if (agentId) query = query.eq("agent_id", agentId);

  const { data, error } = await query;
  if (error) { console.error("DB error:", error.message); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const body = await request.json();

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Support bulk import
  if (Array.isArray(body.leads)) {
    const { data, error } = await supabase.from("leads").upsert(
      body.leads.map((lead: { phone: string; name?: string; tags?: string[]; dynamic_vars?: Record<string, string> }) => ({
        ...lead,
        organization_id: userData.organization_id,
        agent_id: body.agent_id,
      })),
      { onConflict: "phone,agent_id" }
    ).select();

    if (error) { console.error("DB error:", error.message); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
    return NextResponse.json(data, { status: 201 });
  }

  const { data, error } = await supabase.from("leads").insert({
    organization_id: userData.organization_id,
    agent_id: body.agent_id,
    phone: body.phone,
    name: body.name,
    tags: body.tags || [],
    dynamic_vars: body.dynamic_vars || {},
  }).select().single();

  if (error) { console.error("DB error:", error.message); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}
