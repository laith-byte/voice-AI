import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { logger } from "@/lib/logger";

const VALID_FEATURES = [
  "workflows",
  "phone_numbers",
  "analytics",
  "conversations",
  "knowledge_base",
  "topics",
  "agent_settings",
  "leads",
  "campaigns",
];

const DEFAULT_ENABLED_MAP: Record<string, boolean> = {
  workflows: true,
  phone_numbers: true,
  analytics: true,
  conversations: true,
  knowledge_base: false,
  topics: false,
  agent_settings: false,
  leads: true,
  campaigns: false,
};

/** GET /api/clients/[id]/client-access — Fetch feature access (seeds defaults if empty) */
export async function GET(
  _request: NextRequest,
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

  const { data, error } = await supabase
    .from("client_access")
    .select("*")
    .eq("client_id", clientId);

  if (error) {
    logger.error("Failed to fetch client access", { error: error.message, clientId });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  if (!data || data.length === 0) {
    // Seed defaults
    const inserts = VALID_FEATURES.map((key) => ({
      client_id: clientId,
      feature: key,
      enabled: DEFAULT_ENABLED_MAP[key],
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("client_access")
      .insert(inserts)
      .select();

    if (insertError) {
      logger.error("Failed to seed client access defaults", { error: insertError.message, clientId });
      return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }

    return NextResponse.json({ features: inserted || [] });
  }

  return NextResponse.json({ features: data });
}

/** PUT /api/clients/[id]/client-access — Upsert feature access permissions */
export async function PUT(
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
  const { features } = body;

  if (!Array.isArray(features)) {
    return NextResponse.json({ error: "features array is required" }, { status: 400 });
  }

  // Validate and build upsert data
  const upserts = [];
  for (const item of features) {
    if (!item.key || typeof item.enabled !== "boolean") {
      return NextResponse.json({ error: "Each feature must have key and enabled" }, { status: 400 });
    }
    if (!VALID_FEATURES.includes(item.key)) {
      return NextResponse.json({ error: `Invalid feature key: ${item.key}` }, { status: 400 });
    }
    upserts.push({
      client_id: clientId,
      agent_id: null,
      feature: item.key,
      enabled: item.enabled,
    });
  }

  const { error } = await supabase
    .from("client_access")
    .upsert(upserts, { onConflict: "client_id,feature" });

  if (error) {
    logger.error("Failed to save client access", { error: error.message, clientId });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
