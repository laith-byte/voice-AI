import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase.from("users").select("organization_id, client_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  // Determine client_id: direct for client users, or from agent for startup users
  let clientId = userData.client_id;
  if (!clientId && agentId) {
    const { data: agent } = await supabase.from("agents").select("client_id").eq("id", agentId).single();
    clientId = agent?.client_id;
  }

  if (!clientId) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  let query = supabase
    .from("lead_scoring_rules")
    .select("*")
    .eq("client_id", clientId);

  if (agentId) {
    query = query.or(`agent_id.eq.${agentId},agent_id.is.null`);
  }

  const { data, error } = await query.order("agent_id", { ascending: false, nullsFirst: false }).limit(1).single();

  if (error && error.code !== "PGRST116") {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  // Return rules (or defaults if none configured)
  if (!data) {
    return NextResponse.json({
      rules: [
        { criterion: "call_completed", points: 20, label: "Call completed successfully" },
        { criterion: "duration_over_2min", points: 10, label: "Call lasted over 2 minutes" },
        { criterion: "appointment_booked", points: 30, label: "Appointment booked" },
        { criterion: "callback_requested", points: 15, label: "Callback requested" },
        { criterion: "positive_sentiment", points: 10, label: "Positive sentiment detected" },
        { criterion: "repeat_caller", points: 5, label: "Repeat caller" },
        { criterion: "voicemail_left", points: 5, label: "Voicemail left" },
      ],
      is_default: true,
    });
  }

  return NextResponse.json({ ...data, is_default: false });
}

export async function PUT(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase.from("users").select("organization_id, client_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();
  const { agent_id, rules } = body;

  if (!rules || !Array.isArray(rules)) {
    return NextResponse.json({ error: "rules must be an array" }, { status: 400 });
  }

  // Determine client_id
  let clientId = userData.client_id;
  if (!clientId && agent_id) {
    const { data: agent } = await supabase.from("agents").select("client_id").eq("id", agent_id).single();
    clientId = agent?.client_id;
  }

  if (!clientId) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("lead_scoring_rules")
    .upsert(
      {
        client_id: clientId,
        agent_id: agent_id || null,
        rules,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,agent_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}
