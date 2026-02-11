import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { decrypt } from "@/lib/crypto";
import { getIntegrationKey } from "@/lib/integrations";
import Retell from "retell-sdk";

function getRetellClient(apiKey: string) {
  return new Retell({ apiKey });
}

// POST: Create a chat session or send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();

  const { data: agent, error } = await supabase
    .from("agents")
    .select("retell_agent_id, retell_api_key_encrypted, platform, organization_id, client_id")
    .eq("id", id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (agent.platform !== "retell-chat") {
    return NextResponse.json({ error: "Agent is not a chat agent" }, { status: 400 });
  }

  const retellApiKey = (agent.retell_api_key_encrypted ? decrypt(agent.retell_api_key_encrypted) : null)
    || await getIntegrationKey(agent.organization_id, "retell")
    || process.env.RETELL_API_KEY;
  if (!retellApiKey) {
    return NextResponse.json({ error: "No Retell API key configured" }, { status: 500 });
  }

  const retell = getRetellClient(retellApiKey);

  try {
    const { action } = body;

    if (action === "create") {
      // Create a new chat session
      const chatResponse = await retell.chat.create({
        agent_id: agent.retell_agent_id,
      });

      // Retell doesn't return the begin_message on session creation.
      // Fetch the LLM config to get the begin_message for display.
      let beginMessage = "";
      const retellApiKey2 = retellApiKey;
      try {
        const agentRes = await fetch(
          `https://api.retellai.com/get-chat-agent/${agent.retell_agent_id}`,
          { headers: { Authorization: `Bearer ${retellApiKey2}` } }
        );
        if (agentRes.ok) {
          const agentData = await agentRes.json();
          const llmId = agentData.response_engine?.llm_id;
          if (llmId) {
            const llmRes = await fetch(
              `https://api.retellai.com/get-retell-llm/${llmId}`,
              { headers: { Authorization: `Bearer ${retellApiKey2}` } }
            );
            if (llmRes.ok) {
              const llmData = await llmRes.json();
              beginMessage = llmData.begin_message || "";
            }
          }
        }
      } catch {
        // Failed to fetch begin_message, client will use its own fallback
      }

      return NextResponse.json({
        chat_id: chatResponse.chat_id,
        status: chatResponse.chat_status,
        begin_message: beginMessage,
      });
    }

    if (action === "message") {
      const { chat_id, content } = body;
      if (!chat_id || !content) {
        return NextResponse.json({ error: "chat_id and content are required" }, { status: 400 });
      }

      const completion = await retell.chat.createChatCompletion({
        chat_id,
        content,
      });

      // Extract agent messages from the response
      const agentMessages = completion.messages
        .filter((msg) => msg.role === "agent")
        .map((msg) => ("content" in msg ? msg.content : ""));

      return NextResponse.json({
        messages: agentMessages,
      });
    }

    if (action === "end") {
      const { chat_id } = body;
      if (chat_id) {
        // End the chat session
        try {
          await retell.chat.end(chat_id);
        } catch {
          // Chat may already be ended
        }

        // Retrieve the full chat and save to call_logs
        try {
          const chatData = await retell.chat.retrieve(chat_id);

          // Extract agent/user messages for transcript
          const transcript = (chatData.message_with_tool_calls || [])
            .filter((msg) => msg.role === "agent" || msg.role === "user")
            .map((msg) => ({
              role: msg.role,
              content: "content" in msg ? msg.content : "",
              time:
                "created_timestamp" in msg && msg.created_timestamp
                  ? new Date(msg.created_timestamp).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "",
            }));

          // Only save if there were actual messages
          if (transcript.length > 0) {
            const durationSeconds =
              chatData.start_timestamp && chatData.end_timestamp
                ? Math.round((chatData.end_timestamp - chatData.start_timestamp) / 1000)
                : null;

            await supabase.from("call_logs").insert({
              organization_id: agent.organization_id,
              client_id: agent.client_id,
              agent_id: id,
              retell_call_id: chat_id,
              direction: "inbound",
              status: chatData.chat_status || "ended",
              duration_seconds: durationSeconds,
              transcript,
              summary: chatData.chat_analysis?.chat_summary || null,
              evaluation:
                chatData.chat_analysis?.chat_successful !== undefined
                  ? chatData.chat_analysis.chat_successful
                    ? "Success"
                    : "Failed"
                  : null,
              metadata: {
                type: "chat",
                user_sentiment: chatData.chat_analysis?.user_sentiment || null,
                disconnection_reason: "chat_ended",
              },
              started_at: chatData.start_timestamp
                ? new Date(chatData.start_timestamp).toISOString()
                : new Date().toISOString(),
            });
          }
        } catch (saveErr) {
          console.error("Failed to save chat conversation:", saveErr);
        }
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Chat API error" },
      { status: 500 }
    );
  }
}
