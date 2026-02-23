import { NextRequest, NextResponse } from "next/server";
import { getClientIp, publicEndpointLimiter, rateLimitExceeded } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/resend";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed, resetMs } = publicEndpointLimiter.check(ip);
  if (!allowed) return rateLimitExceeded(resetMs);

  try {
    const { name, email, company, phone, industry, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      );
    }

    const allowedIndustries = ["hvac", "plumbing", "electrical", "landscaping", "roofing", "general", "other"];
    if (industry && (typeof industry !== "string" || !allowedIndustries.includes(industry.toLowerCase()))) {
      return NextResponse.json(
        { error: "Invalid industry value" },
        { status: 400 }
      );
    }

    const notifyTo = process.env.CONTACT_FORM_EMAIL || "sales@invarialabs.com";

    await sendEmail({
      to: notifyTo,
      subject: `Contact Form: ${escapeHtml(name)} from ${escapeHtml(company || "N/A")}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Company:</strong> ${escapeHtml(company || "N/A")}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone || "N/A")}</p>
        <p><strong>Industry:</strong> ${escapeHtml(industry || "N/A")}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message)}</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
