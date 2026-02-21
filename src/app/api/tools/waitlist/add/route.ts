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
  const { caller_phone, name, service_requested, preferred_time, agent_id } = body;

  if (!client_id || !caller_phone) {
    return NextResponse.json(
      { error: "client_id and caller_phone are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    const { data: entry, error } = await supabase
      .from("waitlist_entries")
      .insert({
        client_id,
        agent_id: agent_id || null,
        caller_phone,
        caller_name: name || null,
        service_requested: service_requested || null,
        preferred_time: preferred_time || null,
      })
      .select("id, status")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      waitlist_id: entry?.id,
      message: "You have been added to the waitlist",
    });
  } catch (err) {
    console.error("Waitlist add error:", err);
    return NextResponse.json(
      { error: "Failed to add to waitlist" },
      { status: 500 }
    );
  }
}
