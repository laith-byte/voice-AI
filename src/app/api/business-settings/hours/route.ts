import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { regeneratePrompt } from "@/lib/prompt-generator";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const { data, error } = await supabase
    .from("business_hours")
    .select("*")
    .eq("client_id", clientId)
    .order("day_of_week");

  if (error) {
    console.error("DB error:", error.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  const body: Array<{
    day_of_week: number;
    is_open: boolean;
    open_time: string | null;
    close_time: string | null;
  }> = await request.json();

  // Upsert all 7 rows atomically (avoids delete+insert race condition)
  const rows = body.map((h) => ({
    client_id: clientId,
    day_of_week: h.day_of_week,
    is_open: h.is_open,
    open_time: h.open_time,
    close_time: h.close_time,
  }));

  const { data, error: upsertError } = await supabase
    .from("business_hours")
    .upsert(rows, { onConflict: "client_id,day_of_week" })
    .select();

  if (upsertError) {
    console.error("DB error:", upsertError.message);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }

  regeneratePrompt(clientId!).catch(err => console.error("Prompt regeneration failed:", err));

  return NextResponse.json(data);
}
