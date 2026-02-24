import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { logger } from "@/lib/logger";

/** POST /api/clients/[id]/assigned-agents — Assign an agent to a client */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  // Verify admin role
  const { data: userData } = await supabase
    .from("users")
    .select("role, organization_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.role?.startsWith("startup_")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // Verify client belongs to same org
  const { data: client } = await supabase
    .from("clients")
    .select("organization_id")
    .eq("id", clientId)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (client.organization_id !== userData.organization_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { agent_id } = body;

  if (!agent_id || typeof agent_id !== "string") {
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
  }

  // Verify agent belongs to same org and is unassigned
  const { data: agent } = await supabase
    .from("agents")
    .select("id, organization_id, client_id")
    .eq("id", agent_id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (agent.organization_id !== userData.organization_id) {
    return NextResponse.json({ error: "Agent does not belong to your organization" }, { status: 403 });
  }

  if (agent.client_id) {
    return NextResponse.json({ error: "Agent is already assigned to a client" }, { status: 409 });
  }

  const { error } = await supabase
    .from("agents")
    .update({ client_id: clientId })
    .eq("id", agent_id);

  if (error) {
    logger.error("Failed to assign agent", { error: error.message, agentId: agent_id, clientId });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/** DELETE /api/clients/[id]/assigned-agents — Unassign an agent from a client */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  // Verify admin role
  const { data: userData } = await supabase
    .from("users")
    .select("role, organization_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.role?.startsWith("startup_")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const { agent_id } = body;

  if (!agent_id || typeof agent_id !== "string") {
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
  }

  // Verify agent is actually assigned to this client
  const { data: agent } = await supabase
    .from("agents")
    .select("id, client_id, organization_id")
    .eq("id", agent_id)
    .eq("client_id", clientId)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found or not assigned to this client" }, { status: 404 });
  }

  if (agent.organization_id !== userData.organization_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("agents")
    .update({ client_id: null })
    .eq("id", agent_id);

  if (error) {
    logger.error("Failed to unassign agent", { error: error.message, agentId: agent_id, clientId });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
