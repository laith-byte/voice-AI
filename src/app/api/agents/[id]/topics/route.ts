import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id: agentId } = await params;

  // Verify agent belongs to user's organization
  const { data: agent } = await supabase.from("agents").select("organization_id").eq("id", agentId).single();
  if (!agent || agent.organization_id !== userData.organization_id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("topics")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id: agentId } = await params;

  // Verify agent belongs to user's organization
  const { data: agent } = await supabase.from("agents").select("organization_id").eq("id", agentId).single();
  if (!agent || agent.organization_id !== userData.organization_id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await request.json();

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Topic name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("topics")
    .insert({
      agent_id: agentId,
      name: body.name.trim(),
      description: typeof body.description === "string" ? body.description.trim() || null : null,
    })
    .select()
    .single();

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id: agentId } = await params;

  // Verify agent belongs to user's organization
  const { data: agent } = await supabase.from("agents").select("organization_id").eq("id", agentId).single();
  if (!agent || agent.organization_id !== userData.organization_id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const topicId = searchParams.get("topicId");

  if (!topicId) {
    return NextResponse.json({ error: "topicId is required" }, { status: 400 });
  }

  // Verify topic belongs to this agent
  const { data: topic } = await supabase
    .from("topics")
    .select("id")
    .eq("id", topicId)
    .eq("agent_id", agentId)
    .single();

  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("topics")
    .delete()
    .eq("id", topicId)
    .eq("agent_id", agentId);

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
