import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id, sourceId } = await params;

  const { data: agent, error } = await supabase
    .from("agents")
    .select("retell_api_key_encrypted, organization_id")
    .eq("id", id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Verify user belongs to same organization as the agent
  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData || userData.organization_id !== agent.organization_id) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Get the source to find retell_kb_id
  const { data: source } = await supabase
    .from("knowledge_base_sources")
    .select("retell_kb_id")
    .eq("id", sourceId)
    .eq("agent_id", id)
    .single();

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  // Delete from Retell if we have a KB ID
  if (source.retell_kb_id) {
    const retellApiKey =
      (agent.retell_api_key_encrypted ? decrypt(agent.retell_api_key_encrypted) : null) ||
      (await getIntegrationKey(agent.organization_id, "retell")) ||
      process.env.RETELL_API_KEY;

    if (retellApiKey) {
      try {
        await fetch(
          `https://api.retellai.com/delete-knowledge-base/${source.retell_kb_id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${retellApiKey}` },
          }
        );
      } catch {
        // Non-fatal: proceed with local deletion
        console.error("Failed to delete KB from Retell");
      }
    }
  }

  // Delete from our database
  const { error: deleteError } = await supabase
    .from("knowledge_base_sources")
    .delete()
    .eq("id", sourceId)
    .eq("agent_id", id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete source" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
