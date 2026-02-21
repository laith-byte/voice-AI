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
  const { phone, name, tags, dynamic_vars, agent_id } = body;

  if (!client_id || !phone) {
    return NextResponse.json(
      { error: "client_id and phone are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    // Get the agent and org for this client
    let resolvedAgentId = agent_id;
    if (!resolvedAgentId) {
      const { data: agent } = await supabase
        .from("agents")
        .select("id")
        .eq("client_id", client_id)
        .limit(1)
        .single();
      resolvedAgentId = agent?.id;
    }

    if (!resolvedAgentId) {
      return NextResponse.json(
        { error: "No agent found for this client" },
        { status: 400 }
      );
    }

    // Get organization_id from agent
    const { data: agentData } = await supabase
      .from("agents")
      .select("organization_id")
      .eq("id", resolvedAgentId)
      .single();

    const { data: lead, error } = await supabase
      .from("leads")
      .upsert(
        {
          agent_id: resolvedAgentId,
          organization_id: agentData?.organization_id,
          phone,
          name: name || null,
          tags: tags || [],
          dynamic_vars: dynamic_vars || {},
        },
        { onConflict: "agent_id,phone" }
      )
      .select("id, phone, name")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      lead_id: lead?.id,
      phone: lead?.phone,
      name: lead?.name,
    });
  } catch (err) {
    console.error("Lead create error:", err);
    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 }
    );
  }
}
