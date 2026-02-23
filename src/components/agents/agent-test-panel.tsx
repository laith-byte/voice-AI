"use client";

import { useState, useEffect, useRef } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  X,
  Send,
  MessageSquareText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRetellCall } from "@/hooks/use-retell-call";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AgentTestPanelProps {
  agentId: string;
  isChat?: boolean;
  firstMessage?: string;
  onClose: () => void;
}

export function AgentTestPanel({
  agentId,
  isChat = false,
  firstMessage = "",
  onClose,
}: AgentTestPanelProps) {
  const {
    isCallActive,
    isAgentTalking,
    isMuted,
    transcript,
    startCall,
    stopCall,
    toggleMute,
  } = useRetellCall();
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  // Tab: "audio" or "chat"
  const [activeTab, setActiveTab] = useState<"audio" | "chat">(
    isChat ? "chat" : "audio"
  );

  // Chat state
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<
    { role: "agent" | "user"; content: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatStarting, setChatStarting] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = transcriptContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  function handleClose() {
    if (isCallActive) stopCall();
    if (chatSessionId) {
      fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", chat_id: chatSessionId }),
      }).catch(() => {});
      setChatSessionId(null);
      setChatMessages([]);
    }
    onClose();
  }

  async function handleStartChat() {
    setChatStarting(true);
    setChatMessages([]);
    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      if (!res.ok) throw new Error("Failed to create chat session");
      const data = await res.json();
      setChatSessionId(data.chat_id);
      const greeting = data.begin_message || firstMessage;
      if (greeting) {
        setChatMessages([{ role: "agent", content: greeting }]);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start chat"
      );
    } finally {
      setChatStarting(false);
    }
  }

  async function handleSendMessage() {
    if (!chatInput.trim() || !chatSessionId || chatSending) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatSending(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          chat_id: chatSessionId,
          content: userMsg,
        }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      if (data.messages?.length > 0) {
        setChatMessages((prev) => [
          ...prev,
          ...data.messages.map((content: string) => ({
            role: "agent" as const,
            content,
          })),
        ]);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send message"
      );
    } finally {
      setChatSending(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border bg-white flex flex-col overflow-hidden h-[calc(100vh-220px)]">
      {/* Tab header — matches Retell's "Test Audio / Test Chat / {}" tabs */}
      <div className="flex items-center border-b px-1 pt-1">
        <button
          onClick={() => setActiveTab("audio")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-colors",
            activeTab === "audio"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Phone className="size-3" />
          Test Audio
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-colors",
            activeTab === "chat"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageSquareText className="size-3" />
          Test Chat
        </button>
        <div className="flex-1" />
        <button
          onClick={handleClose}
          className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors mr-1"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* ── Audio tab ─────────────────────────────────────────────────────── */}
      {activeTab === "audio" && (
        <div className="flex-1 flex flex-col">
          {!isCallActive && transcript.length === 0 ? (
            /* Idle state — microphone icon + Test button */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                <Mic className="size-7 text-gray-400" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Test your agent</p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full px-6"
                onClick={() => startCall(agentId)}
              >
                Test
              </Button>
            </div>
          ) : (
            /* Active / post-call state — transcript */
            <>
              {/* Status bar */}
              {isCallActive && (
                <div className="px-4 py-2 border-b bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        isAgentTalking
                          ? "bg-blue-500 animate-pulse"
                          : "bg-green-500 animate-pulse"
                      )}
                    />
                    <span className="text-xs text-muted-foreground">
                      {isAgentTalking ? "Agent speaking..." : "Listening..."}
                    </span>
                  </div>
                </div>
              )}

              {/* Transcript */}
              <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                {transcript.length === 0 && isCallActive && (
                  <div className="text-center py-6">
                    <div className="flex justify-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Waiting for conversation...</p>
                  </div>
                )}
                {transcript.map((entry, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "text-xs px-2.5 py-1.5 rounded-lg max-w-[90%]",
                      entry.role === "agent"
                        ? "bg-blue-50 text-blue-900 mr-auto"
                        : "bg-gray-100 text-gray-900 ml-auto"
                    )}
                  >
                    <span className="text-[9px] font-semibold uppercase text-gray-400 block mb-0.5">
                      {entry.role === "agent" ? "Agent" : "You"}
                    </span>
                    {entry.content}
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div className="px-3 py-2.5 border-t bg-gray-50/50">
                {isCallActive ? (
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full w-8 h-8"
                      onClick={toggleMute}
                    >
                      {isMuted ? (
                        <MicOff className="size-3.5 text-red-500" />
                      ) : (
                        <Mic className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      className="rounded-full w-10 h-10 bg-red-600 hover:bg-red-700"
                      onClick={stopCall}
                    >
                      <PhoneOff className="size-4 text-white" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => startCall(agentId)}
                  >
                    <Phone className="size-3.5" />
                    Call Again
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Chat tab ──────────────────────────────────────────────────────── */}
      {activeTab === "chat" && (
        <div className="flex-1 flex flex-col">
          {!chatSessionId && !chatStarting ? (
            /* Idle state */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                <MessageSquareText className="size-7 text-gray-400" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Test your agent</p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full px-6"
                onClick={handleStartChat}
                disabled={chatStarting}
              >
                Test
              </Button>
            </div>
          ) : chatStarting ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6">
              <Loader2 className="size-6 animate-spin text-blue-500" />
              <p className="text-xs text-gray-400">Starting chat...</p>
            </div>
          ) : (
            /* Active chat */
            <>
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "text-xs px-2.5 py-1.5 rounded-lg max-w-[90%]",
                      msg.role === "agent"
                        ? "bg-blue-50 text-blue-900 mr-auto"
                        : "bg-gray-100 text-gray-900 ml-auto"
                    )}
                  >
                    <span className="text-[9px] font-semibold uppercase text-gray-400 block mb-0.5">
                      {msg.role === "agent" ? "Agent" : "You"}
                    </span>
                    {msg.content}
                  </div>
                ))}
                {chatSending && (
                  <div className="bg-blue-50 text-blue-900 mr-auto text-xs px-2.5 py-2 rounded-lg max-w-[90%]">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="px-3 py-2.5 border-t bg-gray-50/50">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Input
                    placeholder="Type a message..."
                    className="flex-1 text-xs h-8"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={chatSending}
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="shrink-0 h-8 w-8 bg-blue-600 hover:bg-blue-700"
                    disabled={!chatInput.trim() || chatSending}
                  >
                    <Send className="size-3.5" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
