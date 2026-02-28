import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyToolAuth } from "@/lib/api/verify-tool-auth";

export async function POST(request: NextRequest) {
  const { client_id, body, error } = await verifyToolAuth(request);
  if (error) return error;

  const { phone, name, tags, dynamic_vars } = body;

  if (!phone) {
    return NextResponse.json(
      { error: "client_id and phone are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    // Find leads for this client's agents
    const { data: agents } = await supabase
      .from("agents")
      .select("id")
      .eq("client_id", client_id);

    const agentIds = (agents || []).map((a) => a.id);
    if (agentIds.length === 0) {
      return NextResponse.json(
        { error: "No agents found for this client" },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (tags !== undefined) updates.tags = tags;
    if (dynamic_vars !== undefined) updates.dynamic_vars = dynamic_vars;

    const { data: lead, error } = await supabase
      .from("leads")
      .update(updates)
      .eq("phone", phone)
      .in("agent_id", agentIds)
      .select("id, phone, name, tags, dynamic_vars")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      lead,
    });
  } catch (err) {
    console.error("Lead update error:", err);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 }
    );
  }
}
