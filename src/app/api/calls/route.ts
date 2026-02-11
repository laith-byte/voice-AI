import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getIntegrationKey } from "@/lib/integrations";
import { getClientIp, publicEndpointLimiter, rateLimitExceeded } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  let query = supabase.from("call_logs").select("*").order("created_at", { ascending: false }).limit(100);
  if (agentId) query = query.eq("agent_id", agentId);

  const { data, error } = await query;
  if (error) { console.error("DB error:", error.message); return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 }); }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed, resetMs } = publicEndpointLimiter.check(ip);
  if (!allowed) return rateLimitExceeded(resetMs);

  const body = await request.json();
  const { action } = body;

  if (action === "create_web_call") {
    try {
      // Resolve per-org integration key if possible
      let orgApiKey: string | null = null;
      if (body.agent_id) {
        const supabase = await createClient();
        const { data: agent } = await supabase
          .from("agents")
          .select("organization_id")
          .eq("retell_agent_id", body.agent_id)
          .limit(1)
          .single();
        if (agent?.organization_id) {
          orgApiKey = await getIntegrationKey(agent.organization_id, "retell");
        }
      }

      const retellApi = await import("@/lib/retell");
      const result = await retellApi.createWebCall({
        agent_id: body.agent_id,
        metadata: body.metadata,
        ...(orgApiKey ? { apiKey: orgApiKey } : {}),
      });
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ error: "Failed to create web call" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
