import { WebClient } from "@slack/web-api";
import { getValidToken } from "@/lib/oauth/token-manager";

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
}

export async function executeSlack(
  callLog: CallLog,
  clientId: string,
  config: Record<string, unknown>
): Promise<void> {
  const channelId = config.channel_id as string;
  if (!channelId) {
    throw new Error("No channel_id configured");
  }

  const accessToken = await getValidToken(clientId, "slack");
  const slack = new WebClient(accessToken);

  const statusEmoji = callLog.status === "completed" ? ":white_check_mark:" : ":x:";
  const duration = callLog.duration_seconds
    ? `${Math.floor(callLog.duration_seconds / 60)}m ${callLog.duration_seconds % 60}s`
    : "N/A";
  const time = callLog.started_at
    ? new Date(callLog.started_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "Unknown time";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${callLog.status === "completed" ? "Call Completed" : "Missed Call"}`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Status:* ${statusEmoji} ${callLog.status}` },
        { type: "mrkdwn", text: `*Duration:* ${duration}` },
        { type: "mrkdwn", text: `*Caller:* ${callLog.from_number || "Unknown"}` },
        { type: "mrkdwn", text: `*Time:* ${time}` },
      ],
    },
  ];

  if (callLog.summary) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Summary:*\n${callLog.summary}` },
    });
  }

  if (config.include_transcript && callLog.transcript) {
    const transcriptText =
      typeof callLog.transcript === "string"
        ? callLog.transcript
        : JSON.stringify(callLog.transcript, null, 2);

    // Slack has a 3000 char limit per text block
    const truncated =
      transcriptText.length > 2900
        ? transcriptText.slice(0, 2900) + "\n...(truncated)"
        : transcriptText;

    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Transcript:*\n\`\`\`${truncated}\`\`\`` },
    });
  }

  await slack.chat.postMessage({
    channel: channelId,
    text: `${callLog.status === "completed" ? "Call Completed" : "Missed Call"} from ${callLog.from_number || "Unknown"}`,
    blocks,
  });
}
