import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { logger } from "@/lib/logger";
import { isSafeWebhookUrl } from "@/lib/url-validation";

export async function GET() {
  const { supabase, response } = await requireAuth();
  if (response) return response;

  const { data, error } = await supabase
    .from("solutions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { logger.error("DB error", { error: error.message }); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const body = await request.json();

  if (body.webhook_url && !isSafeWebhookUrl(body.webhook_url)) {
    return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
  }

  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user!.id).single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await supabase.from("solutions").insert({
    organization_id: userData.organization_id,
    name: body.name,
    description: body.description || null,
    webhook_url: body.webhook_url || null,
    is_active: body.is_active ?? true,
  }).select().single();

  if (error) { logger.error("DB error", { error: error.message }); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { supabase, response } = await requireAuth();
  if (response) return response;

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (body.webhook_url && !isSafeWebhookUrl(body.webhook_url)) {
    return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.is_active !== undefined) update.is_active = body.is_active;
  if (body.name !== undefined) update.name = body.name;
  if (body.webhook_url !== undefined) update.webhook_url = body.webhook_url;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("solutions")
    .update(update)
    .eq("id", body.id)
    .select()
    .single();

  if (error) { logger.error("DB error", { error: error.message }); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data);
}
