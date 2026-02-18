import { Client } from "@notionhq/client";

interface CallLog {
  id: string;
  retell_call_id: string;
  from_number: string | null;
  to_number: string | null;
  direction: string;
  status: string;
  duration_seconds: number;
  summary: string | null;
  transcript: unknown;
  started_at: string | null;
  ended_at: string | null;
  post_call_analysis: unknown;
}

export async function executeNotion(
  callLog: CallLog,
  _clientId: string,
  config: Record<string, unknown>
): Promise<void> {
  const apiKey = config.notion_api_key as string;
  const databaseId = config.database_id as string;

  if (!apiKey) throw new Error("No notion_api_key configured");
  if (!databaseId) throw new Error("No database_id configured");

  const notion = new Client({ auth: apiKey });

  const duration = callLog.duration_seconds
    ? `${Math.floor(callLog.duration_seconds / 60)}m ${callLog.duration_seconds % 60}s`
    : "N/A";

  const startedAt = callLog.started_at
    ? new Date(callLog.started_at).toISOString()
    : undefined;

  // Build page properties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Name: {
      title: [
        {
          text: {
            content: `Call ${callLog.status === "completed" ? "Completed" : "Missed"} — ${callLog.from_number || "Unknown"}`,
          },
        },
      ],
    },
    Status: {
      select: { name: callLog.status },
    },
    Caller: {
      rich_text: [{ text: { content: callLog.from_number || "Unknown" } }],
    },
    Duration: {
      rich_text: [{ text: { content: duration } }],
    },
    Direction: {
      select: { name: callLog.direction },
    },
  };

  if (startedAt) {
    properties["Date"] = { date: { start: startedAt } };
  }

  // Build page children (body content)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  if (callLog.summary) {
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Summary" } }],
      },
    });
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: callLog.summary } }],
      },
    });
  }

  if (config.include_transcript && callLog.transcript) {
    const transcriptText =
      typeof callLog.transcript === "string"
        ? callLog.transcript
        : JSON.stringify(callLog.transcript, null, 2);

    children.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Transcript" } }],
      },
    });

    // Notion blocks have a 2000-char limit per rich_text content
    const chunks: string[] = [];
    for (let i = 0; i < transcriptText.length; i += 1900) {
      chunks.push(transcriptText.slice(i, i + 1900));
    }
    for (const chunk of chunks) {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: chunk } }],
        },
      });
    }
  }

  await notion.pages.create({
    parent: { database_id: databaseId },
    properties,
    children: children.length > 0 ? children : undefined,
  });
}
