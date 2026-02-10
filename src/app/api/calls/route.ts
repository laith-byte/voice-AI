import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  let query = supabase.from("call_logs").select("*").order("created_at", { ascending: false }).limit(100);
  if (agentId) query = query.eq("agent_id", agentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  if (action === "create_web_call") {
    try {
      const retellApi = await import("@/lib/retell");
      const result = await retellApi.createWebCall({
        agent_id: body.agent_id,
        metadata: body.metadata,
      });
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ error: "Failed to create web call" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
