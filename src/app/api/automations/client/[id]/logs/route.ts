import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

// GET — Fetch execution logs for a specific client automation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, supabase, response } = await requireAuth();
  if (response) return response;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: logs, error } = await supabase
    .from("automation_logs")
    .select("*")
    .eq("client_automation_id", id)
    .order("executed_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: logs || [] });
}
