import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getClientId } from "@/lib/api/get-client-id";
import { regeneratePrompt } from "@/lib/prompt-generator";

export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { clientId, error: clientError } = await getClientId(user!, supabase, request);
  if (clientError) return clientError;

  try {
    await regeneratePrompt(clientId!);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Prompt regeneration failed:", err.message);
    return NextResponse.json({ error: "Prompt regeneration failed" }, { status: 500 });
  }
}
