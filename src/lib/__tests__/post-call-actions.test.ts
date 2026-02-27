import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSendEmail = vi.fn().mockResolvedValue({ id: "email-1" });
const mockSendSms = vi.fn().mockResolvedValue({ sid: "sms-1" });
const mockInsert = vi.fn().mockResolvedValue({ error: null });

// Track query results per call
let actionsAgentResult: { data: unknown[] | null };
let actionsClientResult: { data: unknown[] | null };
let settingsResult: { data: unknown };

vi.mock("@/lib/resend", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock("@/lib/twilio", () => ({
  sendSms: (...args: unknown[]) => mockSendSms(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() => {
    let queryCount = 0;
    return Promise.resolve({
      from: (table: string) => {
        if (table === "post_call_actions") {
          queryCount++;
          if (queryCount === 1) {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => Promise.resolve(actionsAgentResult),
                  }),
                  is: () => ({
                    eq: () => Promise.resolve(actionsClientResult),
                  }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  eq: () => Promise.resolve(actionsClientResult),
                }),
              }),
            }),
          };
        }
        if (table === "business_settings") {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve(settingsResult),
              }),
            }),
          };
        }
        if (table === "scheduled_emails") {
          return { insert: mockInsert };
        }
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) };
      },
    });
  }),
}));

import { executePostCallActions } from "../post-call-actions";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeCallLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "log-1",
    retell_call_id: "retell-123",
    client_id: "client-1",
    from_number: "+15551234567",
    to_number: "+15559876543",
    direction: "inbound",
    status: "completed",
    duration_seconds: 120,
    summary: "Caller asked about pricing.",
    transcript: [
      { role: "agent", content: "Hello, how can I help?" },
      { role: "user", content: "What are your prices?" },
    ],
    recording_url: "https://example.com/recording.wav",
    started_at: "2026-02-27T10:00:00Z",
    ended_at: "2026-02-27T10:02:00Z",
    post_call_analysis: { caller_email: "caller@example.com", caller_name: "John" },
    metadata: {},
    ...overrides,
  };
}

function makeAction(overrides: Record<string, unknown> = {}) {
  return {
    id: "action-1",
    client_id: "client-1",
    action_type: "email_summary",
    is_enabled: true,
    config: { recipients: ["admin@example.com"], trigger: "all" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  actionsAgentResult = { data: null };
  actionsClientResult = { data: null };
  settingsResult = { data: { business_name: "Test Biz", contact_email: "biz@example.com" } };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("executePostCallActions", () => {
  describe("email_summary action", () => {
    it("sends email to each recipient", async () => {
      actionsAgentResult = {
        data: [
          makeAction({
            config: {
              recipients: ["admin@example.com", "manager@example.com"],
              trigger: "all",
            },
          }),
        ],
      };

      await executePostCallActions(makeCallLog() as never, "client-1", "agent-1");

      expect(mockSendEmail).toHaveBeenCalledTimes(2);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "admin@example.com" })
      );
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "manager@example.com" })
      );
    });

    it("includes business name in subject and from", async () => {
      actionsAgentResult = {
        data: [makeAction({ config: { recipients: ["admin@example.com"], trigger: "all" } })],
      };

      await executePostCallActions(makeCallLog() as never, "client-1", "agent-1");

      const call = mockSendEmail.mock.calls[0][0];
      expect(call.subject).toContain("Test Biz");
      expect(call.from).toContain("Test Biz");
    });

    it("skips when recipients array is empty", async () => {
      actionsAgentResult = {
        data: [makeAction({ config: { recipients: [], trigger: "all" } })],
      };

      await executePostCallActions(makeCallLog() as never, "client-1", "agent-1");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe("sms_notification action", () => {
    it("sends SMS to configured phone number", async () => {
      actionsAgentResult = {
        data: [
          makeAction({
            action_type: "sms_notification",
            config: { phone_number: "+15559999999", trigger: "all" },
          }),
        ],
      };

      await executePostCallActions(makeCallLog() as never, "client-1", "agent-1");

      expect(mockSendSms).toHaveBeenCalledTimes(1);
      expect(mockSendSms).toHaveBeenCalledWith(
        "+15559999999",
        expect.stringContaining("Test Biz")
      );
    });

    it("truncates summary to 140 chars in SMS", async () => {
      actionsAgentResult = {
        data: [
          makeAction({
            action_type: "sms_notification",
            config: { phone_number: "+15559999999", trigger: "all" },
          }),
        ],
      };
      const longSummary = "A".repeat(200);
      const callLog = makeCallLog({ summary: longSummary });

      await executePostCallActions(callLog as never, "client-1", "agent-1");

      const smsBody = mockSendSms.mock.calls[0][1];
      // The summary snippet is max 140 chars, but the full message includes prefix
      expect(smsBody).toContain("A".repeat(140));
      expect(smsBody).not.toContain("A".repeat(141));
    });

    it("uses placeholder when summary is null", async () => {
      actionsAgentResult = {
        data: [
          makeAction({
            action_type: "sms_notification",
            config: { phone_number: "+15559999999", trigger: "all" },
          }),
        ],
      };

      await executePostCallActions(
        makeCallLog({ summary: null }) as never,
        "client-1",
        "agent-1"
      );

      const smsBody = mockSendSms.mock.calls[0][1];
      expect(smsBody).toContain("No summary available");
    });

    it("skips when phone_number is missing", async () => {
      actionsAgentResult = {
        data: [
          makeAction({
            action_type: "sms_notification",
            config: { trigger: "all" },
          }),
        ],
      };

      await executePostCallActions(makeCallLog() as never, "client-1", "agent-1");
      expect(mockSendSms).not.toHaveBeenCalled();
    });
  });

  describe("caller_followup_email action", () => {
    it("sends follow-up to caller's email from analysis", async () => {
      actionsAgentResult = {
        data: [
          makeAction({
            action_type: "caller_followup_email",
            config: { trigger: "all", delay_minutes: 0 },
          }),
        ],
      };

      await executePostCallActions(makeCallLog() as never, "client-1", "agent-1");

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "caller@example.com" })
      );
    });

    it("skips when no caller email found", async () => {
      actionsAgentResult = {
        data: [
          makeAction({
            action_type: "caller_followup_email",
            config: { trigger: "all" },
          }),
        ],
      };

      await executePostCallActions(
        makeCallLog({ post_call_analysis: null, metadata: {} }) as never,
        "client-1",
        "agent-1"
      );

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("schedules email when delay_minutes > 0", async () => {
      actionsAgentResult = {
        data: [
          makeAction({
            action_type: "caller_followup_email",
            config: { trigger: "all", delay_minutes: 30 },
          }),
        ],
      };

      await executePostCallActions(makeCallLog() as never, "client-1", "agent-1");

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "caller@example.com",
          status: "pending",
          client_id: "client-1",
        })
      );
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe("no actions configured", () => {
    it("returns early when no actions found", async () => {
      actionsAgentResult = { data: [] };
      actionsClientResult = { data: [] };

      await executePostCallActions(makeCallLog() as never, "client-1", "agent-1");

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockSendSms).not.toHaveBeenCalled();
    });
  });

  describe("trigger filter", () => {
    it("skips action when trigger doesn't match call status", async () => {
      actionsAgentResult = {
        data: [
          makeAction({
            config: { recipients: ["admin@example.com"], trigger: "missed" },
          }),
        ],
      };

      await executePostCallActions(
        makeCallLog({ status: "completed" }) as never,
        "client-1",
        "agent-1"
      );

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("runs action when trigger is 'all' regardless of status", async () => {
      actionsAgentResult = {
        data: [
          makeAction({
            config: { recipients: ["admin@example.com"], trigger: "all" },
          }),
        ],
      };

      await executePostCallActions(
        makeCallLog({ status: "missed" }) as never,
        "client-1",
        "agent-1"
      );

      expect(mockSendEmail).toHaveBeenCalled();
    });
  });

  describe("error isolation", () => {
    it("email failure doesn't block SMS", async () => {
      mockSendEmail.mockRejectedValueOnce(new Error("Email failed"));

      actionsAgentResult = {
        data: [
          makeAction({
            action_type: "email_summary",
            config: { recipients: ["admin@example.com"], trigger: "all" },
          }),
          makeAction({
            id: "action-2",
            action_type: "sms_notification",
            config: { phone_number: "+15559999999", trigger: "all" },
          }),
        ],
      };

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      await executePostCallActions(makeCallLog() as never, "client-1", "agent-1");
      consoleSpy.mockRestore();

      expect(mockSendSms).toHaveBeenCalledTimes(1);
    });
  });

  describe("SECURITY HIGH-08: recording_url XSS via javascript: URI", () => {
    it("javascript: URI is replaced with # to prevent XSS", async () => {
      actionsAgentResult = {
        data: [
          makeAction({
            config: {
              recipients: ["admin@example.com"],
              trigger: "all",
              include_recording: true,
            },
          }),
        ],
      };

      await executePostCallActions(
        makeCallLog({ recording_url: "javascript:alert(1)" }) as never,
        "client-1",
        "agent-1"
      );

      const emailHtml = mockSendEmail.mock.calls[0][0].html;
      // FIX: javascript: URI is now replaced with "#"
      expect(emailHtml).toContain('href="#"');
      expect(emailHtml).not.toContain("javascript:");
    });
  });
});
