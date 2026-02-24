import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

// GET: Fetch ai_analysis_config for an agent (creates default if missing)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user!.id)
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

  // Try to fetch existing config
  const { data: config, error: fetchError } = await supabase
    .from("ai_analysis_config")
    .select("*")
    .eq("agent_id", agentId)
    .maybeSingle();

  if (fetchError) {
    console.error("DB error:", fetchError.message);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }

  if (config) {
    return NextResponse.json(config);
  }

  // No config exists — create defaults
  const { data: newConfig, error: insertError } = await supabase
    .from("ai_analysis_config")
    .insert({ agent_id: agentId })
    .select()
    .single();

  if (insertError) {
    console.error("DB error:", insertError.message);
    return NextResponse.json(
      { error: "Failed to initialize AI analysis config" },
      { status: 500 }
    );
  }

  return NextResponse.json(newConfig, { status: 201 });
}

// POST: Create ai_analysis_config with explicit defaults (startup page)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user!.id)
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

  // Validate boolean fields
  const boolFields = [
    "summary_enabled",
    "evaluation_enabled",
    "auto_tagging_enabled",
    "misunderstood_queries_enabled",
  ] as const;
  for (const field of boolFields) {
    if (body[field] !== undefined && typeof body[field] !== "boolean") {
      return NextResponse.json(
        { error: `${field} must be a boolean` },
        { status: 400 }
      );
    }
  }

  // Validate string fields
  const stringFields = [
    "summary_custom_prompt",
    "evaluation_custom_prompt",
    "auto_tagging_custom_prompt",
    "auto_tagging_mode",
  ] as const;
  for (const field of stringFields) {
    if (
      body[field] !== undefined &&
      body[field] !== null &&
      typeof body[field] !== "string"
    ) {
      return NextResponse.json(
        { error: `${field} must be a string or null` },
        { status: 400 }
      );
    }
  }

  // Validate prompt lengths
  const promptFields = [
    "summary_custom_prompt",
    "evaluation_custom_prompt",
    "auto_tagging_custom_prompt",
  ] as const;
  for (const field of promptFields) {
    if (typeof body[field] === "string" && body[field].length > 5000) {
      return NextResponse.json(
        { error: `${field} must be 5000 characters or less` },
        { status: 400 }
      );
    }
  }

  if (
    body.auto_tagging_mode !== undefined &&
    body.auto_tagging_mode !== null &&
    body.auto_tagging_mode !== "auto" &&
    body.auto_tagging_mode !== "manual"
  ) {
    return NextResponse.json(
      { error: 'auto_tagging_mode must be "auto" or "manual"' },
      { status: 400 }
    );
  }

  const { data: newConfig, error: insertError } = await supabase
    .from("ai_analysis_config")
    .insert({
      agent_id: agentId,
      summary_enabled: body.summary_enabled ?? true,
      summary_custom_prompt: body.summary_custom_prompt ?? null,
      evaluation_enabled: body.evaluation_enabled ?? true,
      evaluation_custom_prompt: body.evaluation_custom_prompt ?? null,
      auto_tagging_enabled: body.auto_tagging_enabled ?? false,
      auto_tagging_mode: body.auto_tagging_mode ?? "auto",
      auto_tagging_custom_prompt: body.auto_tagging_custom_prompt ?? null,
      misunderstood_queries_enabled:
        body.misunderstood_queries_enabled ?? false,
    })
    .select()
    .single();

  if (insertError) {
    console.error("DB error:", insertError.message);
    return NextResponse.json(
      { error: "Failed to create AI analysis config" },
      { status: 500 }
    );
  }

  return NextResponse.json(newConfig, { status: 201 });
}

// PATCH: Update existing ai_analysis_config
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user!.id)
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

  if (!body.configId || typeof body.configId !== "string") {
    return NextResponse.json(
      { error: "configId is required" },
      { status: 400 }
    );
  }

  // Verify config belongs to this agent
  const { data: existingConfig } = await supabase
    .from("ai_analysis_config")
    .select("id")
    .eq("id", body.configId)
    .eq("agent_id", agentId)
    .single();

  if (!existingConfig) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  // Validate boolean fields
  const boolFields = [
    "summary_enabled",
    "evaluation_enabled",
    "auto_tagging_enabled",
    "misunderstood_queries_enabled",
  ] as const;
  for (const field of boolFields) {
    if (body[field] !== undefined && typeof body[field] !== "boolean") {
      return NextResponse.json(
        { error: `${field} must be a boolean` },
        { status: 400 }
      );
    }
  }

  // Validate string fields
  const stringFields = [
    "summary_custom_prompt",
    "evaluation_custom_prompt",
    "auto_tagging_custom_prompt",
    "auto_tagging_mode",
  ] as const;
  for (const field of stringFields) {
    if (
      body[field] !== undefined &&
      body[field] !== null &&
      typeof body[field] !== "string"
    ) {
      return NextResponse.json(
        { error: `${field} must be a string or null` },
        { status: 400 }
      );
    }
  }

  // Validate prompt lengths
  const promptFields = [
    "summary_custom_prompt",
    "evaluation_custom_prompt",
    "auto_tagging_custom_prompt",
  ] as const;
  for (const field of promptFields) {
    if (typeof body[field] === "string" && body[field].length > 5000) {
      return NextResponse.json(
        { error: `${field} must be 5000 characters or less` },
        { status: 400 }
      );
    }
  }

  if (
    body.auto_tagging_mode !== undefined &&
    body.auto_tagging_mode !== null &&
    body.auto_tagging_mode !== "auto" &&
    body.auto_tagging_mode !== "manual"
  ) {
    return NextResponse.json(
      { error: 'auto_tagging_mode must be "auto" or "manual"' },
      { status: 400 }
    );
  }

  // Build the update object with only provided fields
  const updateData: Record<string, unknown> = {};
  if (body.summary_enabled !== undefined)
    updateData.summary_enabled = body.summary_enabled;
  if (body.summary_custom_prompt !== undefined)
    updateData.summary_custom_prompt = body.summary_custom_prompt;
  if (body.evaluation_enabled !== undefined)
    updateData.evaluation_enabled = body.evaluation_enabled;
  if (body.evaluation_custom_prompt !== undefined)
    updateData.evaluation_custom_prompt = body.evaluation_custom_prompt;
  if (body.auto_tagging_enabled !== undefined)
    updateData.auto_tagging_enabled = body.auto_tagging_enabled;
  if (body.auto_tagging_mode !== undefined)
    updateData.auto_tagging_mode = body.auto_tagging_mode;
  if (body.auto_tagging_custom_prompt !== undefined)
    updateData.auto_tagging_custom_prompt = body.auto_tagging_custom_prompt;
  if (body.misunderstood_queries_enabled !== undefined)
    updateData.misunderstood_queries_enabled =
      body.misunderstood_queries_enabled;

  const { error } = await supabase
    .from("ai_analysis_config")
    .update(updateData)
    .eq("id", body.configId);

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json(
      { error: "Failed to update AI analysis config" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
