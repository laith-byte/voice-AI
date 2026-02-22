import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getIntegrationKey } from "@/lib/integrations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();
  const agentId: string | null = body.agentId ?? null;

  // Update local DB
  const { data: phoneRecord, error: updateError } = await supabase
    .from("phone_numbers")
    .update({ agent_id: agentId })
    .eq("id", id)
    .select("*, agents(retell_agent_id)")
    .single();

  if (updateError || !phoneRecord) {
    console.error("DB error:", updateError?.message);
    return NextResponse.json({ error: "Failed to update phone number" }, { status: 500 });
  }

  // Sync to Retell if we have a retell_number_id
  if (phoneRecord.retell_number_id) {
    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user!.id)
      .single();

    if (userData) {
      const retellApiKey = await getIntegrationKey(userData.organization_id, "retell") || process.env.RETELL_API_KEY;
      if (retellApiKey) {
        try {
          let retellAgentId: string | null = null;

          if (agentId) {
            // Look up the agent's retell_agent_id
            const { data: agentData } = await supabase
              .from("agents")
              .select("retell_agent_id")
              .eq("id", agentId)
              .single();
            retellAgentId = agentData?.retell_agent_id || null;
          }

          const retellRes = await fetch(
            `https://api.retellai.com/update-phone-number/${encodeURIComponent(phoneRecord.retell_number_id)}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${retellApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                inbound_agent_id: retellAgentId,
                outbound_agent_id: retellAgentId,
              }),
            }
          );

          if (!retellRes.ok) {
            const retellErr = await retellRes.text();
            console.error("Retell assign error:", retellErr);
          }
        } catch (err) {
          console.error("Retell assign error:", err);
        }
      }
    }
  }

  return NextResponse.json(phoneRecord);
}
