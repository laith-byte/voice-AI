import { Resend } from "resend";
import { noReplyFrom } from "@/lib/email";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

export async function sendEmail({
  to,
  subject,
  html,
  from,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}) {
  return getResend().emails.send({
    from: from || noReplyFrom("Invaria Labs"),
    to,
    subject,
    html,
    ...(replyTo ? { reply_to: replyTo } : {}),
  });
}
