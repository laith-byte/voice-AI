import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  let query = supabase.from("leads").select("*").order("created_at", { ascending: false });
  if (agentId) query = query.eq("agent_id", agentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  // Support bulk import
  if (Array.isArray(body.leads)) {
    const { data, error } = await supabase.from("leads").upsert(
      body.leads.map((lead: { phone: string; name?: string; tags?: string[]; dynamic_vars?: Record<string, string> }) => ({
        ...lead,
        organization_id: body.organization_id,
        agent_id: body.agent_id,
      })),
      { onConflict: "phone,agent_id" }
    ).select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  const { data, error } = await supabase.from("leads").insert({
    organization_id: body.organization_id,
    agent_id: body.agent_id,
    phone: body.phone,
    name: body.name,
    tags: body.tags || [],
    dynamic_vars: body.dynamic_vars || {},
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
