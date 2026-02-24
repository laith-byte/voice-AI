import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { logger } from "@/lib/logger";

/** POST /api/clients/[id]/solutions — Add a solution to a client */
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
  const { solution_id } = body;

  if (!solution_id || typeof solution_id !== "string") {
    return NextResponse.json({ error: "solution_id is required" }, { status: 400 });
  }

  // Verify solution belongs to same org
  const { data: solution } = await supabase
    .from("solutions")
    .select("id, organization_id")
    .eq("id", solution_id)
    .single();

  if (!solution) {
    return NextResponse.json({ error: "Solution not found" }, { status: 404 });
  }

  if (solution.organization_id !== userData.organization_id) {
    return NextResponse.json({ error: "Solution does not belong to your organization" }, { status: 403 });
  }

  const { error } = await supabase
    .from("client_solutions")
    .insert({ client_id: clientId, solution_id });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Solution already assigned to this client" }, { status: 409 });
    }
    logger.error("Failed to add solution", { error: error.message, solutionId: solution_id, clientId });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

/** DELETE /api/clients/[id]/solutions — Remove a solution from a client */
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
  const { solution_id } = body;

  if (!solution_id || typeof solution_id !== "string") {
    return NextResponse.json({ error: "solution_id is required" }, { status: 400 });
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

  const { error } = await supabase
    .from("client_solutions")
    .delete()
    .eq("client_id", clientId)
    .eq("solution_id", solution_id);

  if (error) {
    logger.error("Failed to remove solution", { error: error.message, solutionId: solution_id, clientId });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
