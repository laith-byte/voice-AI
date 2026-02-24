import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { regenerateKnowledgeBase } from "@/lib/knowledge-base-generator";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const { data, error } = await supabase
    .from("business_faqs")
    .select("*")
    .eq("client_id", clientId)
    .order("sort_order");

  if (error) {
    logger.error("DB error", { error: error.message });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const body = await request.json();

  const { data, error } = await supabase
    .from("business_faqs")
    .insert({
      client_id: clientId,
      question: body.question,
      answer: body.answer,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    logger.error("DB error", { error: error.message });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  regenerateKnowledgeBase(clientId!).catch(err => logger.error("KB regeneration failed", { error: String(err) }));

  return NextResponse.json(data, { status: 201 });
}
