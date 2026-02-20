import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  let query = supabase.from("campaigns").select("*").eq("organization_id", userData.organization_id).order("created_at", { ascending: false }).limit(500);
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

  // Verify agent belongs to user's organization
  if (body.agent_id) {
    const { data: agent } = await supabase.from("agents").select("organization_id").eq("id", body.agent_id).single();
    if (!agent || agent.organization_id !== userData.organization_id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
  }

  const { data, error } = await supabase.from("campaigns").insert({
    organization_id: userData.organization_id,
    agent_id: body.agent_id,
    name: body.name,
    status: "draft",
    start_date: body.start_date,
    phone_number_ids: body.phone_number_ids || [],
    cycle_numbers: body.cycle_numbers || false,
    calling_days: body.calling_days || ["mon", "tue", "wed", "thu", "fri"],
    calling_hours_start: body.calling_hours_start || "09:00",
    calling_hours_end: body.calling_hours_end || "17:00",
    timezone_mode: body.timezone_mode || "auto",
    timezone: body.timezone,
    retry_attempts: body.retry_attempts || 2,
    retry_interval_hours: body.retry_interval_hours || 4,
    calling_rate: body.calling_rate || 5,
    calling_rate_minutes: body.calling_rate_minutes || 1,
    total_leads: body.total_leads || 0,
    completed_leads: 0,
  }).select().single();

  if (error) { console.error("DB error:", error.message); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}
