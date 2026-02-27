/**
 * SSRF protection: validates that a URL does not target private/internal addresses.
 * Consolidated from webhook-test/route.ts and compile-flow-to-retell.ts.
 */
export function isSafeWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }

    // Block private/internal hostnames
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname === "metadata.google.internal" ||
      hostname === "169.254.169.254"
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
