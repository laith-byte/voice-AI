import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey || apiKey !== process.env.RETELL_TOOLS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = await request.json();
  const client_id = url.searchParams.get("client_id") || body.client_id;
  const { form_data, form_type, caller_phone } = body;

  if (!client_id || !form_data || !caller_phone) {
    return NextResponse.json(
      { error: "client_id, form_data, and caller_phone are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    // Find the lead by phone for this client's agents
    const { data: agents } = await supabase
      .from("agents")
      .select("id, organization_id")
      .eq("client_id", client_id);

    const agentIds = (agents || []).map((a) => a.id);
    if (agentIds.length === 0) {
      return NextResponse.json(
        { error: "No agents found for this client" },
        { status: 400 }
      );
    }

    // Try to find existing lead, or create one
    let { data: lead } = await supabase
      .from("leads")
      .select("id, dynamic_vars")
      .eq("phone", caller_phone)
      .in("agent_id", agentIds)
      .limit(1)
      .single();

    if (!lead) {
      // Create a new lead with the intake data
      const { data: newLead, error: createError } = await supabase
        .from("leads")
        .insert({
          agent_id: agentIds[0],
          organization_id: agents![0].organization_id,
          phone: caller_phone,
          dynamic_vars: {
            intake_forms: [
              {
                type: form_type || "general",
                data: form_data,
                collected_at: new Date().toISOString(),
              },
            ],
          },
        })
        .select("id")
        .single();

      if (createError) throw createError;

      return NextResponse.json({
        success: true,
        lead_id: newLead?.id,
        message: "Intake information has been recorded",
      });
    }

    // Append to existing lead's dynamic_vars
    const existingVars = (lead.dynamic_vars as Record<string, unknown>) || {};
    const existingForms = Array.isArray(existingVars.intake_forms)
      ? existingVars.intake_forms
      : [];

    const { error: updateError } = await supabase
      .from("leads")
      .update({
        dynamic_vars: {
          ...existingVars,
          intake_forms: [
            ...existingForms,
            {
              type: form_type || "general",
              data: form_data,
              collected_at: new Date().toISOString(),
            },
          ],
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      lead_id: lead.id,
      message: "Intake information has been recorded",
    });
  } catch (err) {
    console.error("Intake collect error:", err);
    return NextResponse.json(
      { error: "Failed to collect intake data" },
      { status: 500 }
    );
  }
}
