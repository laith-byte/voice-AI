import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";

export async function POST(request: NextRequest) {
  try {
    const { name, email, company, phone, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      );
    }

    const notifyTo = process.env.CONTACT_FORM_EMAIL || "hello@invarialabs.com";

    await sendEmail({
      to: notifyTo,
      subject: `Contact Form: ${name} from ${company || "N/A"}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${company || "N/A"}</p>
        <p><strong>Phone:</strong> ${phone || "N/A"}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p>${message}</p>
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
