import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const body = await request.json();

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user!.id)
    .single();
  if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("agent_templates")
    .insert({
      organization_id: userData.organization_id,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      text_provider: body.text_provider || "openai",
      voice_provider: body.voice_provider || "retell",
      retell_agent_id: body.retell_agent_id?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    logger.error("DB error", { error: error.message });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("agent_templates")
    .delete()
    .eq("id", id);

  if (error) {
    logger.error("DB error", { error: error.message });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
