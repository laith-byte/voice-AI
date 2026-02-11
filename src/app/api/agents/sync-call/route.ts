import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { user, supabase, response } = await requireAuth();
    if (response) return response;

    const body = await request.json();
    const { call_id, agent_id } = body;

    if (!call_id || !agent_id) {
      return NextResponse.json(
        { error: "call_id and agent_id are required" },
        { status: 400 }
      );
    }

    // Fetch agent record to verify ownership and get credentials
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, retell_agent_id, retell_api_key_encrypted, organization_id, client_id")
      .eq("id", agent_id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const retellApiKey = agent.retell_api_key_encrypted || process.env.RETELL_API_KEY;
    if (!retellApiKey) {
      return NextResponse.json(
        { error: "No Retell API key configured" },
        { status: 500 }
      );
    }

    // Fetch the full call object from Retell API
    const retellRes = await fetch(
      `https://api.retellai.com/v2/get-call/${call_id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${retellApiKey}`,
        },
      }
    );

    if (!retellRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch call from Retell" },
        { status: retellRes.status }
      );
    }

    const call = await retellRes.json();

    // Calculate duration
    let durationSeconds = 0;
    if (call.duration_ms) {
      durationSeconds = Math.round(call.duration_ms / 1000);
    } else if (call.end_timestamp && call.start_timestamp) {
      durationSeconds = Math.round(
        (call.end_timestamp - call.start_timestamp) / 1000
      );
    }

    // Map status
    let status = call.call_status || "completed";
    if (status === "ended") status = "completed";

    // Build evaluation string from custom_analysis_data
    let evaluation: string | null = null;
    if (call.call_analysis?.custom_analysis_data) {
      evaluation =
        typeof call.call_analysis.custom_analysis_data === "string"
          ? call.call_analysis.custom_analysis_data
          : JSON.stringify(call.call_analysis.custom_analysis_data);
    }

    // Build the call_logs record
    const callLog = {
      retell_call_id: call.call_id,
      organization_id: agent.organization_id,
      client_id: agent.client_id,
      agent_id: agent.id,
      status,
      duration_seconds: durationSeconds,
      from_number: call.from_number || null,
      to_number: call.to_number || null,
      direction: call.direction || "inbound",
      recording_url: call.recording_url || null,
      transcript: call.transcript_object || null,
      summary: call.call_analysis?.call_summary || null,
      evaluation,
      post_call_analysis: call.call_analysis || null,
      started_at: call.start_timestamp
        ? new Date(call.start_timestamp).toISOString()
        : null,
      ended_at: call.end_timestamp
        ? new Date(call.end_timestamp).toISOString()
        : null,
      metadata: {
        ...(call.metadata || {}),
        call_type: call.call_type,
        disconnection_reason: call.disconnection_reason,
        source: "portal",
      },
    };

    // Use service client for upsert to bypass RLS
    const serviceSupabase = await createServiceClient();

    const { error: upsertError } = await serviceSupabase
      .from("call_logs")
      .upsert(callLog, { onConflict: "retell_call_id" });

    if (upsertError) {
      console.error("Failed to upsert call log:", upsertError);
      return NextResponse.json(
        { error: "Failed to save call log" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sync call error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
