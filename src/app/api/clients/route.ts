import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { safeJson } from "@/lib/api/safe-json";
import { logger } from "@/lib/logger";

export async function GET() {
  const { supabase, response } = await requireAuth();
  if (response) return response;

  const { data, error } = await supabase
    .from("clients")
    .select("*, agents(id)")
    .order("created_at", { ascending: false });
  if (error) { logger.error("DB error", { error: error.message }); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { body, error: jsonError } = await safeJson<Record<string, any>>(request);
  if (jsonError) return jsonError;

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await supabase.from("clients").insert({
    organization_id: userData.organization_id,
    name: body.name,
    slug: body.slug,
    language: body.language || "en",
    dashboard_theme: body.dashboard_theme || "light",
    status: body.status || "active",
  }).select().single();

  if (error) { logger.error("DB error", { error: error.message }); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}
