"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, X, Minus, Send, Loader2 } from "lucide-react";
import { useDashboardTheme } from "@/components/portal/dashboard-theme-provider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface ChatAgent {
  id: string;
  name: string;
}

interface ChatMessage {
  role: "user" | "agent";
  content: string;
}

export function PortalChatWidget() {
  const { color } = useDashboardTheme();
  const [chatAgent, setChatAgent] = useState<ChatAgent | null>(null);
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check for chat agents on mount
  useEffect(() => {
    async function fetchChatAgent() {
      const supabase = createClient();
      const { data } = await supabase
        .from("agents")
        .select("id, name")
        .in("platform", ["retell-chat", "retell-sms"])
        .limit(1)
        .single();
      if (data) setChatAgent(data);
    }
    fetchChatAgent();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const startChat = useCallback(async () => {
    if (!chatAgent) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/agents/${chatAgent.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      if (!res.ok) throw new Error("Failed to start chat");
      const data = await res.json();
      setChatId(data.chat_id);
      setMessages(
        data.begin_message
          ? [{ role: "agent" as const, content: data.begin_message }]
          : []
      );
    } catch {
      // Silently handle - user can retry
    } finally {
      setStarting(false);
    }
  }, [chatAgent]);

  const sendMessage = useCallback(async () => {
    if (!chatId || !input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content }]);
    setSending(true);
    try {
      const res = await fetch(`/api/agents/${chatAgent!.id}/chat`, {
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
  }, [chatId, chatAgent, input, sending]);

  const endChat = useCallback(async () => {
    if (chatId && chatAgent) {
      try {
        await fetch(`/api/agents/${chatAgent.id}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end", chat_id: chatId }),
        });
      } catch {
        // Best-effort cleanup
      }
    }
    setChatId(null);
    setMessages([]);
    setOpen(false);
  }, [chatId, chatAgent]);

  const minimize = useCallback(() => {
    setOpen(false);
  }, []);

  // Don't render if no chat agent
  if (!chatAgent) return null;

  return (
    <>
      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl border bg-background shadow-2xl overflow-hidden"
          style={{ maxHeight: "min(520px, calc(100vh - 8rem))" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white shrink-0"
            style={{ backgroundColor: color || "hsl(var(--primary))" }}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-semibold">{chatAgent.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/20"
                onClick={minimize}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/20"
                onClick={endChat}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          {!chatId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3 min-h-[200px]">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: (color || "hsl(var(--primary))") + "20" }}
              >
                <MessageSquare className="w-6 h-6" style={{ color: color || "hsl(var(--primary))" }} />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Start a conversation with {chatAgent.name}
              </p>
              <Button
                onClick={startChat}
                disabled={starting}
                style={{ backgroundColor: color || undefined }}
                className={cn(!color && "bg-primary", "text-white hover:opacity-90")}
              >
                {starting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  "Start Chat"
                )}
              </Button>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 min-h-0">
                <div ref={scrollRef} className="p-4 space-y-3">
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
                            ? "text-white rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        )}
                        style={
                          msg.role === "user"
                            ? { backgroundColor: color || "hsl(var(--primary))" }
                            : undefined
                        }
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="border-t px-3 py-2.5 flex items-center gap-2 shrink-0">
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
                  style={{ backgroundColor: color || undefined }}
                  disabled={!input.trim() || sending}
                  onClick={sendMessage}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: color || "hsl(var(--primary))" }}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>
    </>
  );
}
