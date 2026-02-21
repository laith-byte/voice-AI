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
  const { phone, email } = body;

  if (!client_id || (!phone && !email)) {
    return NextResponse.json(
      { error: "client_id and either phone or email are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    // Get agents for this client
    const { data: agents } = await supabase
      .from("agents")
      .select("id")
      .eq("client_id", client_id);

    const agentIds = (agents || []).map((a) => a.id);
    if (agentIds.length === 0) {
      return NextResponse.json({ found: false });
    }

    // Search leads by phone
    let lead = null;
    if (phone) {
      const { data } = await supabase
        .from("leads")
        .select("id, phone, name, tags, dynamic_vars, created_at, updated_at")
        .eq("phone", phone)
        .in("agent_id", agentIds)
        .limit(1)
        .single();
      lead = data;
    }

    if (!lead && email) {
      // Search in dynamic_vars for email
      const { data: leads } = await supabase
        .from("leads")
        .select("id, phone, name, tags, dynamic_vars, created_at, updated_at")
        .in("agent_id", agentIds);

      lead = (leads || []).find(
        (l) =>
          (l.dynamic_vars as Record<string, unknown>)?.email === email
      ) || null;
    }

    if (!lead) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      contact: {
        id: lead.id,
        phone: lead.phone,
        name: lead.name,
        tags: lead.tags,
        custom_data: lead.dynamic_vars,
        first_seen: lead.created_at,
        last_updated: lead.updated_at,
      },
    });
  } catch (err) {
    console.error("Contact lookup error:", err);
    return NextResponse.json(
      { error: "Failed to look up contact" },
      { status: 500 }
    );
  }
}
