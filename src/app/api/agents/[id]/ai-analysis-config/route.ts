import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

const ALLOWED_FIELDS = new Set([
  "summary_enabled",
  "summary_custom_prompt",
  "evaluation_enabled",
  "evaluation_custom_prompt",
  "auto_tagging_enabled",
  "auto_tagging_mode",
  "auto_tagging_custom_prompt",
  "misunderstood_queries_enabled",
]);

export async function GET(
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
  if (!userData)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

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
    .from("ai_analysis_config")
    .select("*")
    .eq("agent_id", agentId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("DB error:", error.message);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }

  return NextResponse.json(data || null);
}

export async function PUT(
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
  if (!userData)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

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

  // Only allow safe fields
  const safeBody: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      safeBody[key] = body[key];
    }
  }

  // Validate boolean fields
  for (const field of [
    "summary_enabled",
    "evaluation_enabled",
    "auto_tagging_enabled",
    "misunderstood_queries_enabled",
  ]) {
    if (field in safeBody && typeof safeBody[field] !== "boolean") {
      return NextResponse.json(
        { error: `${field} must be a boolean` },
        { status: 400 }
      );
    }
  }

  // Validate string fields
  for (const field of [
    "summary_custom_prompt",
    "evaluation_custom_prompt",
    "auto_tagging_custom_prompt",
  ]) {
    if (
      field in safeBody &&
      safeBody[field] !== null &&
      typeof safeBody[field] !== "string"
    ) {
      return NextResponse.json(
        { error: `${field} must be a string or null` },
        { status: 400 }
      );
    }
  }

  // Validate auto_tagging_mode
  if (
    "auto_tagging_mode" in safeBody &&
    safeBody.auto_tagging_mode !== null &&
    typeof safeBody.auto_tagging_mode !== "string"
  ) {
    return NextResponse.json(
      { error: "auto_tagging_mode must be a string or null" },
      { status: 400 }
    );
  }

  // Upsert: if id is provided, include it; otherwise create new
  const upsertData = {
    ...safeBody,
    agent_id: agentId,
    ...(body.id ? { id: body.id } : {}),
  };

  const { data, error } = await supabase
    .from("ai_analysis_config")
    .upsert(upsertData)
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
