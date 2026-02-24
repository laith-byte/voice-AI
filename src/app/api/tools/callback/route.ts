import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey || apiKey !== process.env.RETELL_TOOLS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = await request.json();
  const client_id = url.searchParams.get("client_id") || body.client_id;
  const { question, caller_phone, caller_name } = body;

  if (!client_id || !question) {
    return NextResponse.json(
      { error: "client_id and question are required" },
      { status: 400 }
    );
  }

  if (!caller_phone) {
    return NextResponse.json({
      success: false,
      message: "I need the caller's phone number before I can arrange a callback. Please ask for their phone number first.",
    });
  }

  try {
    const supabase = await createServiceClient();

    // Look up business settings for contact email and timezone
    const { data: settings } = await supabase
      .from("business_settings")
      .select("contact_email, business_name, timezone")
      .eq("client_id", client_id)
      .single();

    const recipientEmail = settings?.contact_email;
    if (!recipientEmail) {
      return NextResponse.json({
        success: false,
        message: "I'm sorry, I wasn't able to send a message to the team. Please try calling back during business hours.",
      });
    }

    // Look up agent for this client
    const { data: agent } = await supabase
      .from("agents")
      .select("id, retell_agent_id")
      .eq("client_id", client_id)
      .limit(1)
      .single();

    if (!agent) {
      return NextResponse.json({
        success: false,
        message: "I'm sorry, something went wrong. Please try calling back during business hours.",
      });
    }

    // Insert pending_callbacks row
    const { data: callback, error: insertError } = await supabase
      .from("pending_callbacks")
      .insert({
        client_id,
        agent_id: agent.id,
        caller_phone,
        caller_name: caller_name || null,
        question,
        timezone: settings?.timezone || "America/Los_Angeles",
      })
      .select("id")
      .single();

    if (insertError || !callback) {
      logger.error("Failed to insert pending_callback", { error: String(insertError) });
      return NextResponse.json(
        { error: "Failed to create callback request" },
        { status: 500 }
      );
    }

    // Send email to business owner with reply-to address
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const bizName = settings?.business_name || "Your Business";

    await sendEmail({
      to: recipientEmail,
      subject: `Callback Request — ${bizName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #1a1a2e;">A caller needs your help</h2>
          <p>Your AI agent couldn't answer a question and promised to call back with the answer.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          ${caller_name ? `<p><strong>Caller:</strong> ${esc(caller_name)}</p>` : ""}
          ${caller_phone ? `<p><strong>Phone:</strong> ${esc(caller_phone)}</p>` : ""}
          <p><strong>Question:</strong> ${esc(question)}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <p style="font-size: 16px; font-weight: 600;">Simply reply to this email with the answer, and we'll call them back automatically.</p>
          <p style="color: #666; font-size: 13px;">The AI agent will present your answer naturally as if it researched it. The caller won't know a human was involved.</p>
        </div>
      `,
      replyTo: `callback-${callback.id}@reply.invarialabs.com`,
    });

    return NextResponse.json({
      success: true,
      message: "I've sent a message to the team with your question. Someone will get back to you soon with the answer.",
    });
  } catch (err) {
    logger.error("Callback tool error", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to process callback request" },
      { status: 500 }
    );
  }
}
