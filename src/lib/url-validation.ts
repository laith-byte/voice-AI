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
      hostname === "169.254.169.254" ||
      // IPv6 link-local (fe80::/10)
      hostname.startsWith("fe80:") ||
      hostname.startsWith("[fe80:") ||
      // IPv6 unique-local (fd00::/7: fd00::/8 and fc00::/8)
      ((hostname.startsWith("fd") || hostname.startsWith("fc")) && hostname.includes(":")) ||
      (hostname.startsWith("[fd") || hostname.startsWith("[fc"))
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
