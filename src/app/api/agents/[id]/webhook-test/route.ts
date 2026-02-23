import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";

// POST: Proxy a webhook test request server-side to avoid CORS issues
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const { url } = await request.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing webhook URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "test",
        call_id: "test_" + Date.now(),
        agent_id: id,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10000),
    });

    return NextResponse.json({ status: res.status, ok: res.ok });
  } catch {
    return NextResponse.json({ error: "Failed to reach webhook URL" }, { status: 502 });
  }
}
