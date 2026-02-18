import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";
import Retell from "retell-sdk";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;

  const { data: agent, error } = await supabase
    .from("agents")
    .select("retell_api_key_encrypted, organization_id")
    .eq("id", id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const retellApiKey =
    (agent.retell_api_key_encrypted
      ? decrypt(agent.retell_api_key_encrypted)
      : null) ||
    (await getIntegrationKey(agent.organization_id, "retell")) ||
    process.env.RETELL_API_KEY;

  if (!retellApiKey) {
    return NextResponse.json(
      { error: "No Retell API key configured" },
      { status: 500 }
    );
  }

  try {
    const retell = new Retell({ apiKey: retellApiKey });
    const voices = await retell.voice.list();

    return NextResponse.json(
      voices.map((v) => ({
        voice_id: v.voice_id,
        voice_name: v.voice_name,
        gender: v.gender,
        provider: v.provider,
        accent: v.accent || null,
        age: v.age || null,
      }))
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch voices" },
      { status: 500 }
    );
  }
}
