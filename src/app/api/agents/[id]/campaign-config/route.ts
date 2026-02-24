import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

// POST: Create default campaign_config for an agent
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id: agentId } = await params;

  // Verify agent belongs to user's organization
  const { data: agent } = await supabase
    .from("agents")
    .select("organization_id")
    .eq("id", agentId)
    .single();
  if (!agent || agent.organization_id !== userData.organization_id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("campaign_config")
    .insert({
      agent_id: agentId,
      rate_mode: "min_max",
      min_calls: 1,
      max_calls: 10,
      min_minutes: 1,
      max_minutes: 30,
      fixed_calls: 5,
      fixed_minutes: 15,
    })
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

// PATCH: Update campaign_config by config ID
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id: agentId } = await params;

  // Verify agent belongs to user's organization
  const { data: agent } = await supabase
    .from("agents")
    .select("organization_id")
    .eq("id", agentId)
    .single();
  if (!agent || agent.organization_id !== userData.organization_id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await request.json();

  if (!body.config_id) {
    return NextResponse.json(
      { error: "config_id is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("campaign_config")
    .update({
      rate_mode: body.rate_mode,
      min_calls: body.min_calls,
      max_calls: body.max_calls,
      min_minutes: body.min_minutes,
      max_minutes: body.max_minutes,
      fixed_calls: body.fixed_calls,
      fixed_minutes: body.fixed_minutes,
    })
    .eq("id", body.config_id)
    .eq("agent_id", agentId);

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
