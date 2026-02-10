import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  let query = supabase.from("campaigns").select("*").order("created_at", { ascending: false });
  if (agentId) query = query.eq("agent_id", agentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const { data, error } = await supabase.from("campaigns").insert({
    organization_id: body.organization_id,
    agent_id: body.agent_id,
    name: body.name,
    status: "draft",
    start_date: body.start_date,
    phone_numbers: body.phone_numbers || [],
    phone_cycle: body.phone_cycle || false,
    calling_days: body.calling_days || ["mon", "tue", "wed", "thu", "fri"],
    calling_hours_start: body.calling_hours_start || "09:00",
    calling_hours_end: body.calling_hours_end || "17:00",
    timezone_mode: body.timezone_mode || "auto",
    timezone: body.timezone,
    retry_attempts: body.retry_attempts || 2,
    retry_interval_hours: body.retry_interval_hours || 4,
    calls_per_batch: body.calls_per_batch || 5,
    batch_interval_minutes: body.batch_interval_minutes || 1,
    total_leads: body.total_leads || 0,
    completed_leads: 0,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
