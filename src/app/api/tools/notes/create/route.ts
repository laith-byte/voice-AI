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
  const { caller_phone, note_text, agent_id } = body;

  if (!client_id || !caller_phone || !note_text) {
    return NextResponse.json(
      { error: "client_id, caller_phone, and note_text are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    // Find the lead by phone for this client's agents
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

    const { data: lead } = await supabase
      .from("leads")
      .select("id, dynamic_vars")
      .eq("phone", caller_phone)
      .in("agent_id", agentIds)
      .limit(1)
      .single();

    if (!lead) {
      return NextResponse.json(
        { error: "No contact found with this phone number" },
        { status: 404 }
      );
    }

    // Append note to dynamic_vars.notes array
    const existingVars = (lead.dynamic_vars as Record<string, unknown>) || {};
    const existingNotes = Array.isArray(existingVars.notes) ? existingVars.notes : [];
    const newNote = {
      text: note_text,
      agent_id: agent_id || null,
      timestamp: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("leads")
      .update({
        dynamic_vars: {
          ...existingVars,
          notes: [...existingNotes, newNote],
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Note has been saved",
    });
  } catch (err) {
    console.error("Note create error:", err);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
