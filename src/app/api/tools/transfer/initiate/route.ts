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
  const { transfer_to, reason } = body;

  if (!client_id || !transfer_to) {
    return NextResponse.json(
      { error: "client_id and transfer_to are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    // If transfer_to looks like a phone number, use it directly
    const phoneRegex = /^\+?[\d\s\-()]{7,}$/;
    let transfer_number = transfer_to;

    if (!phoneRegex.test(transfer_to)) {
      // Look up department number from business_settings
      const { data: settings } = await supabase
        .from("business_settings")
        .select("escalation_phone, business_phone")
        .eq("client_id", client_id)
        .single();

      // Use escalation phone or main business phone as fallback
      transfer_number =
        settings?.escalation_phone || settings?.business_phone || null;

      if (!transfer_number) {
        return NextResponse.json({
          success: false,
          error: "No transfer number configured for this department",
        });
      }
    }

    return NextResponse.json({
      success: true,
      transfer_number,
      reason: reason || "Caller requested transfer",
    });
  } catch (err) {
    console.error("Transfer initiate error:", err);
    return NextResponse.json(
      { error: "Failed to initiate transfer" },
      { status: 500 }
    );
  }
}
