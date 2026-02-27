import { describe, it, expect } from "vitest";
import { redactText, redactTranscript } from "../pii-redaction";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<{
  enabled: boolean;
  redact_phone_numbers: boolean;
  redact_emails: boolean;
  redact_ssn: boolean;
  redact_credit_cards: boolean;
  redact_names: boolean;
  custom_patterns: { pattern: string; label: string }[];
}> = {}) {
  return {
    enabled: true,
    redact_phone_numbers: false,
    redact_emails: false,
    redact_ssn: false,
    redact_credit_cards: false,
    redact_names: false,
    custom_patterns: [] as { pattern: string; label: string }[],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Phone number redaction
// ---------------------------------------------------------------------------

describe("redactText — phone numbers", () => {
  const config = makeConfig({ redact_phone_numbers: true });

  it("redacts E.164 format: +15551234567", () => {
    const result = redactText("Call me at +15551234567", config);
    expect(result).not.toContain("+15551234567");
    expect(result).toContain("[PHONE REDACTED]");
  });

  it("redacts parentheses format: (555) 123-4567", () => {
    const result = redactText("Reach me at (555) 123-4567 please", config);
    expect(result).not.toContain("(555) 123-4567");
    expect(result).toContain("[PHONE REDACTED]");
  });

  it("redacts hyphenated format: 555-123-4567", () => {
    const result = redactText("My number is 555-123-4567.", config);
    expect(result).not.toContain("555-123-4567");
    expect(result).toContain("[PHONE REDACTED]");
  });

  it("redacts dotted format: 555.123.4567", () => {
    const result = redactText("Call 555.123.4567 now", config);
    expect(result).not.toContain("555.123.4567");
    expect(result).toContain("[PHONE REDACTED]");
  });

  it("redacts multiple phone numbers in same text", () => {
    const result = redactText("Primary: 555-123-4567, backup: (555) 987-6543", config);
    expect(result).not.toContain("555-123-4567");
    expect(result).not.toContain("(555) 987-6543");
    expect(result).toContain("[PHONE REDACTED]");
  });

  it("leaves text unchanged when no phone is present", () => {
    expect(redactText("No phone here", config)).toBe("No phone here");
  });
});

// ---------------------------------------------------------------------------
// Email redaction
// ---------------------------------------------------------------------------

describe("redactText — emails", () => {
  const config = makeConfig({ redact_emails: true });

  it("redacts a standard email", () => {
    expect(redactText("Email me at user@example.com today", config)).toBe(
      "Email me at [EMAIL REDACTED] today"
    );
  });

  it("redacts email with subdomain", () => {
    expect(redactText("Contact john.doe@mail.company.org", config)).toBe(
      "Contact [EMAIL REDACTED]"
    );
  });

  it("redacts email with plus addressing", () => {
    expect(redactText("Send to user+tag@example.com", config)).toBe(
      "Send to [EMAIL REDACTED]"
    );
  });

  it("redacts multiple emails", () => {
    const result = redactText("a@a.com and b@b.com", config);
    expect(result).toBe("[EMAIL REDACTED] and [EMAIL REDACTED]");
  });
});

// ---------------------------------------------------------------------------
// SSN redaction
// ---------------------------------------------------------------------------

describe("redactText — SSN", () => {
  const config = makeConfig({ redact_ssn: true });

  it("redacts hyphenated SSN: 123-45-6789", () => {
    expect(redactText("My SSN is 123-45-6789", config)).toBe("My SSN is [SSN REDACTED]");
  });

  it("redacts compact SSN: 123456789", () => {
    expect(redactText("SSN: 123456789", config)).toBe("SSN: [SSN REDACTED]");
  });

  it("leaves text unchanged when no SSN pattern present", () => {
    expect(redactText("No sensitive data", config)).toBe("No sensitive data");
  });
});

// ---------------------------------------------------------------------------
// Credit card redaction
// ---------------------------------------------------------------------------

describe("redactText — credit cards", () => {
  const config = makeConfig({ redact_credit_cards: true });

  it("redacts space-separated card: 4111 1111 1111 1111", () => {
    expect(redactText("Card: 4111 1111 1111 1111", config)).toBe("Card: [CC REDACTED]");
  });

  it("redacts hyphenated card: 4111-1111-1111-1111", () => {
    expect(redactText("Card: 4111-1111-1111-1111", config)).toBe("Card: [CC REDACTED]");
  });

  it("redacts compact card number: 4111111111111111", () => {
    expect(redactText("4111111111111111 is my card", config)).toBe("[CC REDACTED] is my card");
  });
});

// ---------------------------------------------------------------------------
// Custom patterns
// ---------------------------------------------------------------------------

describe("redactText — custom patterns", () => {
  it("applies a custom pattern with a custom label", () => {
    const config = makeConfig({
      custom_patterns: [{ pattern: "ACCT-\\d{6}", label: "[ACCOUNT REDACTED]" }],
    });
    expect(redactText("Your account ACCT-123456 is active", config)).toBe(
      "Your account [ACCOUNT REDACTED] is active"
    );
  });

  it("uses default [REDACTED] label when label is empty", () => {
    const config = makeConfig({
      custom_patterns: [{ pattern: "SECRET", label: "" }],
    });
    expect(redactText("This is SECRET info", config)).toBe("This is [REDACTED] info");
  });

  it("skips invalid regex patterns without throwing", () => {
    const config = makeConfig({
      custom_patterns: [{ pattern: "[invalid(", label: "[BAD]" }],
    });
    expect(() => redactText("some text", config)).not.toThrow();
    expect(redactText("some text", config)).toBe("some text");
  });

  it("applies multiple custom patterns", () => {
    const config = makeConfig({
      custom_patterns: [
        { pattern: "FOO", label: "[FOO REDACTED]" },
        { pattern: "BAR", label: "[BAR REDACTED]" },
      ],
    });
    expect(redactText("FOO and BAR are here", config)).toBe(
      "[FOO REDACTED] and [BAR REDACTED] are here"
    );
  });
});

// ---------------------------------------------------------------------------
// Disabled config
// ---------------------------------------------------------------------------

describe("redactText — disabled config", () => {
  it("returns text unchanged when enabled is false", () => {
    const config = makeConfig({
      enabled: false,
      redact_phone_numbers: true,
      redact_emails: true,
      redact_ssn: true,
      redact_credit_cards: true,
    });
    const sensitive = "Call 555-123-4567 or email user@example.com, SSN 123-45-6789";
    expect(redactText(sensitive, config)).toBe(sensitive);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("redactText — edge cases", () => {
  const config = makeConfig({
    redact_phone_numbers: true,
    redact_emails: true,
    redact_ssn: true,
    redact_credit_cards: true,
  });

  it("returns empty string unchanged", () => {
    expect(redactText("", config)).toBe("");
  });

  it("handles multiple PII types in same text", () => {
    const input = "Phone: 555-123-4567, email: user@example.com, SSN: 123-45-6789, card: 4111 1111 1111 1111";
    const result = redactText(input, config);
    expect(result).not.toContain("555-123-4567");
    expect(result).not.toContain("user@example.com");
    expect(result).not.toContain("123-45-6789");
    expect(result).not.toContain("4111 1111 1111 1111");
    expect(result).toContain("[PHONE REDACTED]");
    expect(result).toContain("[EMAIL REDACTED]");
    expect(result).toContain("[SSN REDACTED]");
    expect(result).toContain("[CC REDACTED]");
  });

  it("only redacts enabled types", () => {
    const partialConfig = makeConfig({ redact_phone_numbers: true, redact_emails: false });
    const result = redactText("Call 555-123-4567 or email user@example.com", partialConfig);
    expect(result).not.toContain("555-123-4567");
    expect(result).toContain("[PHONE REDACTED]");
    expect(result).toContain("user@example.com");
  });
});

// ---------------------------------------------------------------------------
// redactTranscript
// ---------------------------------------------------------------------------

describe("redactTranscript", () => {
  const config = makeConfig({ redact_phone_numbers: true, redact_emails: true });

  it("redacts content and words fields of each entry", () => {
    const transcript = [
      { role: "user", content: "Call me at 555-123-4567", words: "Call me at 555-123-4567" },
    ];
    const result = redactTranscript(transcript, config);
    expect(result[0].content).toContain("[PHONE REDACTED]");
    expect(result[0].content).not.toContain("555-123-4567");
    expect(result[0].words).toContain("[PHONE REDACTED]");
    expect(result[0].words).not.toContain("555-123-4567");
  });

  it("preserves the role field", () => {
    const transcript = [{ role: "agent", content: "Hello user@example.com" }];
    const result = redactTranscript(transcript, config);
    expect(result[0].role).toBe("agent");
    expect(result[0].content).toBe("Hello [EMAIL REDACTED]");
  });

  it("handles entries where content is undefined", () => {
    const transcript = [{ role: "agent", words: "Call 555-123-4567" }];
    const result = redactTranscript(transcript, config);
    expect(result[0].content).toBeUndefined();
    expect(result[0].words).toContain("[PHONE REDACTED]");
    expect(result[0].words).not.toContain("555-123-4567");
  });

  it("handles entries where words is undefined", () => {
    const transcript = [{ role: "user", content: "Call 555-123-4567" }];
    const result = redactTranscript(transcript, config);
    expect(result[0].content).toContain("[PHONE REDACTED]");
    expect(result[0].content).not.toContain("555-123-4567");
    expect(result[0].words).toBeUndefined();
  });

  it("processes multiple entries independently", () => {
    const transcript = [
      { role: "user", content: "My phone is 555-111-2222" },
      { role: "agent", content: "I'll email you at user@example.com" },
    ];
    const result = redactTranscript(transcript, config);
    expect(result[0].content).toContain("[PHONE REDACTED]");
    expect(result[0].content).not.toContain("555-111-2222");
    expect(result[1].content).toBe("I'll email you at [EMAIL REDACTED]");
  });

  it("returns transcript unchanged when enabled is false", () => {
    const disabledConfig = makeConfig({ enabled: false, redact_phone_numbers: true });
    const transcript = [{ role: "user", content: "My number is 555-123-4567" }];
    const result = redactTranscript(transcript, disabledConfig);
    expect(result[0].content).toBe("My number is 555-123-4567");
  });

  it("returns empty array when given empty array", () => {
    expect(redactTranscript([], config)).toEqual([]);
  });

  it("does not mutate the original transcript entries", () => {
    const original = [{ role: "user", content: "Email user@example.com" }];
    const originalContent = original[0].content;
    redactTranscript(original, config);
    expect(original[0].content).toBe(originalContent);
  });
});

// ---------------------------------------------------------------------------
// ReDoS protection (HIGH-12)
// ---------------------------------------------------------------------------

describe("redactText — ReDoS protection", () => {
  it("blocks dangerous regex patterns and returns text unchanged", () => {
    const config = makeConfig({
      custom_patterns: [{ pattern: "(a+)+$", label: "[REDACTED]" }],
    });
    const start = Date.now();
    const result = redactText("aaa", config);
    const elapsed = Date.now() - start;
    // Dangerous pattern is rejected by isUnsafeRegex(), text returned as-is
    expect(result).toBe("aaa");
    expect(elapsed).toBeLessThan(500);
  });

  it("allows safe custom patterns to work normally", () => {
    const config = makeConfig({
      custom_patterns: [{ pattern: "\\d{3}-\\d{4}", label: "[PHONE]" }],
    });
    expect(redactText("Call 555-1234 now", config)).toBe("Call [PHONE] now");
  });
});
