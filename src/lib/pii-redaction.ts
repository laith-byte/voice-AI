const PATTERNS: Record<string, RegExp> = {
  phone: /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g,
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  ssn: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
  credit_card: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
};

const LABELS: Record<string, string> = {
  phone: "[PHONE REDACTED]",
  email: "[EMAIL REDACTED]",
  ssn: "[SSN REDACTED]",
  credit_card: "[CC REDACTED]",
};

interface PiiConfig {
  enabled: boolean;
  redact_phone_numbers: boolean;
  redact_emails: boolean;
  redact_ssn: boolean;
  redact_credit_cards: boolean;
  redact_names: boolean;
  custom_patterns: { pattern: string; label: string }[];
}

function getActivePatterns(config: PiiConfig): { regex: RegExp; label: string }[] {
  const active: { regex: RegExp; label: string }[] = [];

  if (config.redact_phone_numbers) active.push({ regex: new RegExp(PATTERNS.phone.source, "g"), label: LABELS.phone });
  if (config.redact_emails) active.push({ regex: new RegExp(PATTERNS.email.source, "g"), label: LABELS.email });
  if (config.redact_ssn) active.push({ regex: new RegExp(PATTERNS.ssn.source, "g"), label: LABELS.ssn });
  if (config.redact_credit_cards) active.push({ regex: new RegExp(PATTERNS.credit_card.source, "g"), label: LABELS.credit_card });

  for (const cp of config.custom_patterns || []) {
    try {
      active.push({ regex: new RegExp(cp.pattern, "g"), label: cp.label || "[REDACTED]" });
    } catch {
      // Skip invalid regex
    }
  }

  return active;
}

export function redactText(text: string, config: PiiConfig): string {
  if (!config.enabled) return text;
  let result = text;
  for (const { regex, label } of getActivePatterns(config)) {
    result = result.replace(regex, label);
  }
  return result;
}

export function redactTranscript(
  transcript: { role?: string; content?: string; words?: string }[],
  config: PiiConfig
): { role?: string; content?: string; words?: string }[] {
  if (!config.enabled) return transcript;
  return transcript.map((entry) => ({
    ...entry,
    content: entry.content ? redactText(entry.content, config) : entry.content,
    words: entry.words ? redactText(entry.words, config) : entry.words,
  }));
}
