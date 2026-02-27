const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || "invarialabs.com";

export const notificationFrom = (name: string) =>
  `${name} <notifications@${EMAIL_DOMAIN}>`;

export const noReplyFrom = (name: string) =>
  `${name} <noreply@${EMAIL_DOMAIN}>`;
