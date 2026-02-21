import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey || apiKey !== process.env.RETELL_TOOLS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = await request.json();
  const client_id = url.searchParams.get("client_id") || body.client_id;
  const { reason, urgency = "medium", caller_phone } = body;

  if (!client_id || !reason) {
    return NextResponse.json(
      { error: "client_id and reason are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();

    const { data: settings } = await supabase
      .from("business_settings")
      .select("contact_email, contact_name, business_name")
      .eq("client_id", client_id)
      .single();

    const recipientEmail = settings?.contact_email;
    if (!recipientEmail) {
      return NextResponse.json({
        success: false,
        error: "No escalation email configured",
      });
    }

    const urgencyLabel = urgency.charAt(0).toUpperCase() + urgency.slice(1);
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    await sendEmail({
      to: recipientEmail,
      subject: `[${urgencyLabel}] Escalation from AI Agent - ${settings?.business_name || ""}`,
      html: `
        <h2>Call Escalation</h2>
        <p><strong>Urgency:</strong> ${esc(urgencyLabel)}</p>
        <p><strong>Reason:</strong> ${esc(reason)}</p>
        ${caller_phone ? `<p><strong>Caller Phone:</strong> ${esc(caller_phone)}</p>` : ""}
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p>This escalation was triggered by your AI phone agent.</p>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Escalation has been sent to the manager",
    });
  } catch (err) {
    console.error("Escalation error:", err);
    return NextResponse.json(
      { error: "Failed to escalate" },
      { status: 500 }
    );
  }
}
