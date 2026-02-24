/**
 * Shared utilities for the callback pipeline.
 */

/**
 * Convert a phone number to E164 format.
 *
 * Handles:
 * - Already E164: "+14155551234" → "+14155551234"
 * - US/Canada 10-digit: "4155551234" → "+14155551234"
 * - US/Canada 11-digit: "14155551234" → "+14155551234"
 * - International with leading +: "+447700900000" → "+447700900000"
 * - International without +: "447700900000" → "+447700900000" (passthrough)
 */
export function toE164(phone: string): string {
  const trimmed = phone.trim();

  // If already starts with +, strip any formatting but keep the +
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.replace(/\D/g, "");
  }

  const digits = trimmed.replace(/\D/g, "");

  // US/Canada: 11 digits starting with 1
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;

  // US/Canada: 10 digits (no country code)
  if (digits.length === 10) return `+1${digits}`;

  // Everything else: assume digits include country code
  return `+${digits}`;
}

/**
 * Calculate a safe callback time in a caller's timezone.
 *
 * Rules:
 * - Between 8 AM and 8 PM local time → call immediately
 * - Outside that window → schedule for 9 AM next day local time
 *
 * Uses Intl.DateTimeFormat for DST-safe timezone handling.
 */
export function calculateNextAttempt(timezone: string): string {
  const now = new Date();

  // Get the full local datetime parts to handle DST correctly
  let callerHour: number;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).formatToParts(now);
    callerHour = parseInt(parts.find((p) => p.type === "hour")?.value || "12");
  } catch {
    callerHour = now.getUTCHours();
  }

  if (callerHour >= 8 && callerHour < 20) {
    // Within safe calling hours — call back immediately
    return now.toISOString();
  }

  // Outside safe hours — compute 9 AM tomorrow in the caller's timezone.
  // Strategy: get the current date in the target timezone, add a day,
  // set to 9:00, then convert back to UTC.
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value || "0";

    const localYear = parseInt(get("year"));
    const localMonth = parseInt(get("month"));
    const localDay = parseInt(get("day"));
    const localHour = parseInt(get("hour"));

    // If before 8 AM, we want 9 AM today; if after 8 PM, we want 9 AM tomorrow.
    const needsTomorrow = localHour >= 20;
    const targetDay = needsTomorrow ? localDay + 1 : localDay;

    // Build a date string in the target timezone: "YYYY-MM-DD 09:00:00"
    // Use Date.parse with timezone to get UTC equivalent
    const localDateStr = `${localYear}-${String(localMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}T09:00:00`;

    // Get UTC offset for the target time by comparing UTC and local at that moment.
    // Create the date in UTC, format it in the timezone, and measure the drift.
    const candidateUtc = new Date(localDateStr + "Z");
    const candidateParts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).formatToParts(candidateUtc);
    const candidateLocalHour = parseInt(
      candidateParts.find((p) => p.type === "hour")?.value || "9"
    );

    // The offset in hours = localHourAtUTCCandidate - 9
    const offsetHours = candidateLocalHour - 9;
    const adjusted = new Date(candidateUtc.getTime() - offsetHours * 60 * 60 * 1000);

    return adjusted.toISOString();
  } catch {
    // Fallback: rough 9 AM next day calculation
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setUTCHours(17, 0, 0, 0); // ~9 AM Pacific as rough fallback
    return tomorrow.toISOString();
  }
}

/**
 * Extract the reply body from an email, stripping quoted text and signatures.
 *
 * Handles: Gmail, Outlook, Apple Mail, Yahoo, and common mobile clients
 * across English, Spanish, French, and German locales.
 */
export function extractReplyBody(text: string): string {
  const lines = text.split("\n");
  const replyLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trimStart();

    // Quoted text markers (> prefix)
    if (/^>/.test(trimmed)) break;

    // English: "On ... wrote:"
    if (/^On .+ wrote:$/i.test(trimmed)) break;

    // Spanish: "El ... escribió:"
    if (/^El .+ escribi[oó]:$/i.test(trimmed)) break;

    // French: "Le ... a écrit :"
    if (/^Le .+ a [eé]crit\s?:$/i.test(trimmed)) break;

    // German: "Am ... schrieb ..."
    if (/^Am .+ schrieb /i.test(trimmed)) break;

    // Outlook-style separator
    if (/^-{3,}/.test(trimmed)) break;
    if (/^_{3,}/.test(trimmed)) break;

    // "From:" header (Outlook forwarded/reply)
    if (/^From:\s/i.test(trimmed)) break;

    // "Sent from my iPhone/iPad/Samsung/etc"
    if (/^Sent from (my |the )?/i.test(trimmed)) break;

    // "Get Outlook for" (Outlook mobile signature)
    if (/^Get Outlook for /i.test(trimmed)) break;

    // Outlook horizontal rule in HTML-stripped text (series of underscores or dashes)
    if (/^[_\-=]{10,}$/.test(trimmed)) break;

    // "Original Message" header
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(trimmed)) break;

    // Yahoo "On [day], [date], [sender] wrote:" variant
    if (/^On \w+day, .+ wrote:$/i.test(trimmed)) break;

    replyLines.push(line);
  }

  return replyLines.join("\n").trim();
}
