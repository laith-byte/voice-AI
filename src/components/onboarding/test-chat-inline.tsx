"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Send,
  Loader2,
  Check,
  Clock,
  MessagesSquare,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "agent";
  content: string;
}

interface TestChatInlineProps {
  agentId: string;
  agentName: string;
  onTestCompleted: () => void;
}

export function TestChatInline({
  agentId,
  agentName,
  onTestCompleted,
}: TestChatInlineProps) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ended, setEnded] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const startChat = useCallback(async () => {
    setStarting(true);
    setEnded(false);
    setMessages([]);
    setDurationSeconds(0);
    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      if (!res.ok) throw new Error("Failed to start chat");
      const data = await res.json();
      setChatId(data.chat_id);
      setStartTime(Date.now());
      if (data.begin_message) {
        setMessages([{ role: "agent", content: data.begin_message }]);
      }
    } catch {
      // User can retry
    } finally {
      setStarting(false);
    }
  }, [agentId]);

  const sendMessage = useCallback(async () => {
    if (!chatId || !input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content }]);
    setSending(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", chat_id: chatId, content }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      if (data.messages) {
        setMessages((prev) => [
          ...prev,
          ...data.messages.map((m: string) => ({
            role: "agent" as const,
            content: m,
          })),
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  }, [chatId, agentId, input, sending]);

  const endChat = useCallback(async () => {
    if (chatId) {
      try {
        await fetch(`/api/agents/${agentId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end", chat_id: chatId }),
        });
      } catch {
        // Best-effort
      }
    }
    if (startTime) {
      setDurationSeconds(Math.round((Date.now() - startTime) / 1000));
    }
    setChatId(null);
    setEnded(true);
    onTestCompleted();
  }, [chatId, agentId, startTime, onTestCompleted]);

  // Pre-chat state
  if (!chatId && !ended) {
    return (
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-primary/5 via-primary/[0.03] to-transparent p-6 border-b">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{agentName}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                  <span className="text-xs text-muted-foreground">
                    Ready to test
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 flex flex-col items-center justify-center text-center py-8">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <MessageSquare className="w-10 h-10 text-primary/60" />
              </div>
              <div
                className="absolute inset-0 rounded-full border-2 border-primary/10 animate-ping"
                style={{ animationDuration: "2s" }}
              />
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              Click the button below to start a test chat. Type messages to see
              how your AI agent responds to visitors.
            </p>
          </div>

          <div className="px-6 pb-6 flex items-center justify-center">
            <Button
              size="lg"
              onClick={startChat}
              disabled={starting}
              className="gap-2 min-w-[180px] bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-lg shadow-primary/20"
            >
              {starting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MessageSquare className="w-4 h-4" />
              )}
              Start Test Chat
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Post-chat report
  if (ended) {
    const userMessages = messages.filter((m) => m.role === "user").length;
    const agentMessages = messages.filter((m) => m.role === "agent").length;

    return (
      <>
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <h3 className="font-semibold text-lg text-center">
          Test Chat Complete!
        </h3>

        <Card className="glass-card">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <MessagesSquare className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="text-lg font-bold">
                  {userMessages + agentMessages}
                </p>
                <p className="text-[11px] text-muted-foreground">Messages</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="text-lg font-bold">
                  {durationSeconds < 60
                    ? `${durationSeconds}s`
                    : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`}
                </p>
                <p className="text-[11px] text-muted-foreground">Duration</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Check className="w-3.5 h-3.5 text-green-600" />
                </div>
                <p className="text-lg font-bold text-green-600">Done</p>
                <p className="text-[11px] text-muted-foreground">Status</p>
              </div>
            </div>

            {/* Conversation preview */}
            {messages.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Conversation Preview
                </h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3 py-1.5 text-xs",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        )}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEnded(false);
                  setMessages([]);
                  setDurationSeconds(0);
                }}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  // Active chat
  return (
    <Card className="glass-card overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-gradient-to-r from-primary/5 via-primary/[0.03] to-transparent p-6 border-b">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{agentName}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">
                  Chat active
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="p-4 space-y-3 min-h-[280px] max-h-[400px] overflow-y-auto"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3 flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message..."
            className="rounded-xl border-muted shadow-none text-sm"
            disabled={sending}
          />
          <Button
            size="sm"
            className="h-9 w-9 p-0 shrink-0 rounded-xl"
            disabled={!input.trim() || sending}
            onClick={sendMessage}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        <div className="px-4 pb-4 flex items-center justify-center">
          <Button
            variant="destructive"
            size="sm"
            onClick={endChat}
            className="gap-2"
          >
            End Chat
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
