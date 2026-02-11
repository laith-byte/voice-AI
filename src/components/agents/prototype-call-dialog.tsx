"use client";

import { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Mic, MicOff, Send, MessageSquareText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRetellCall } from "@/hooks/use-retell-call";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PrototypeCallDialogProps {
  agentId: string;
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isChat?: boolean;
  firstMessage?: string;
}

export function PrototypeCallDialog({
  agentId,
  agentName,
  open,
  onOpenChange,
  isChat = false,
  firstMessage = "",
}: PrototypeCallDialogProps) {
  const { isCallActive, isAgentTalking, isMuted, transcript, startCall, stopCall, toggleMute } =
    useRetellCall();
  const [isConnecting, setIsConnecting] = useState(false);

  // Chat state
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: "agent" | "user"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatStarting, setChatStarting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Reset chat state when dialog closes
  useEffect(() => {
    if (!open) {
      setChatSessionId(null);
      setChatMessages([]);
      setChatInput("");
      setChatSending(false);
      setChatStarting(false);
    }
  }, [open]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function handleStartCall() {
    setIsConnecting(true);
    await startCall(agentId);
    setIsConnecting(false);
  }

  function handleEndCall() {
    stopCall();
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
      toast.error(err instanceof Error ? err.message : "Failed to start chat");
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
        body: JSON.stringify({ action: "message", chat_id: chatSessionId, content: userMsg }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      if (data.messages?.length > 0) {
        setChatMessages((prev) => [
          ...prev,
          ...data.messages.map((content: string) => ({ role: "agent" as const, content })),
        ]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setChatSending(false);
    }
  }

  function handleClose(value: boolean) {
    if (!value) {
      if (isCallActive) stopCall();
      if (chatSessionId) {
        fetch(`/api/agents/${agentId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end", chat_id: chatSessionId }),
        }).catch(() => {});
      }
    }
    onOpenChange(value);
  }

  if (isChat) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              {chatSessionId
                ? `Chat with ${agentName}`
                : `Test ${agentName}`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center py-4 space-y-4">
            {!chatSessionId ? (
              <>
                <div className="relative flex items-center justify-center">
                  <div className="relative z-10 flex items-center justify-center rounded-full w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-200">
                    <MessageSquareText className="w-8 h-8 text-blue-500" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {chatStarting ? "Starting chat..." : "Click the button below to start a test chat"}
                </p>
                <Button
                  size="lg"
                  className="rounded-full px-8 bg-blue-600 hover:bg-blue-700"
                  onClick={handleStartChat}
                  disabled={chatStarting}
                >
                  {chatStarting ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <MessageSquareText className="w-5 h-5 mr-2" />
                  )}
                  {chatStarting ? "Starting..." : "Start Chat"}
                </Button>
              </>
            ) : (
              <>
                <div className="w-full max-h-64 overflow-y-auto border rounded-lg p-3 space-y-2 bg-muted/30">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "text-sm px-3 py-1.5 rounded-lg max-w-[85%] shadow-sm",
                        msg.role === "agent"
                          ? "bg-blue-50 text-blue-900 mr-auto"
                          : "bg-gray-100 text-gray-900 ml-auto"
                      )}
                    >
                      <span className="text-[10px] font-medium uppercase text-muted-foreground block mb-0.5">
                        {msg.role === "agent" ? agentName : "You"}
                      </span>
                      {msg.content}
                    </div>
                  ))}
                  {chatSending && (
                    <div className="bg-blue-50 text-blue-900 mr-auto text-sm px-3 py-2.5 rounded-lg max-w-[85%]">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                  className="flex items-center gap-2 w-full"
                >
                  <Input
                    placeholder="Type a message..."
                    className="flex-1 text-sm"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={chatSending}
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="shrink-0 bg-blue-600 hover:bg-blue-700"
                    disabled={!chatInput.trim() || chatSending}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {isCallActive
              ? `Call with ${agentName}`
              : `Test ${agentName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-6 space-y-6">
          {/* Pulsing Orb */}
          <div className="relative flex items-center justify-center">
            {/* Outer pulse rings */}
            {isCallActive && (
              <>
                <div
                  className={cn(
                    "absolute rounded-full border-2",
                    isAgentTalking
                      ? "border-blue-400 animate-ping"
                      : "border-gray-300 animate-pulse"
                  )}
                  style={{ width: 140, height: 140 }}
                />
                <div
                  className={cn(
                    "absolute rounded-full border",
                    isAgentTalking
                      ? "border-blue-300 animate-ping"
                      : "border-gray-200 animate-pulse"
                  )}
                  style={{
                    width: 170,
                    height: 170,
                    animationDelay: "0.3s",
                  }}
                />
              </>
            )}

            {/* Main orb */}
            <div
              className={cn(
                "relative z-10 flex items-center justify-center rounded-full transition-all duration-500",
                isCallActive
                  ? isAgentTalking
                    ? "w-28 h-28 bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/30"
                    : "w-28 h-28 bg-gradient-to-br from-blue-400 to-blue-600 shadow-md shadow-blue-400/20"
                  : "w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300"
              )}
            >
              {isCallActive ? (
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full mb-1",
                      isAgentTalking ? "bg-white animate-pulse" : "bg-white/60"
                    )}
                  />
                  <span className="text-white text-[10px] font-medium">
                    {isAgentTalking ? "Speaking" : "Listening"}
                  </span>
                </div>
              ) : (
                <Phone className="w-8 h-8 text-gray-500" />
              )}
            </div>
          </div>

          {/* Status text */}
          <p className="text-sm text-muted-foreground">
            {isConnecting
              ? "Connecting..."
              : isCallActive
              ? isAgentTalking
                ? "Agent is speaking..."
                : "Agent is listening..."
              : "Click the button below to start a test call"}
          </p>

          {/* Live transcript */}
          {isCallActive && transcript.length > 0 && (
            <div className="w-full max-h-48 overflow-y-auto border rounded-lg p-3 space-y-2 bg-muted/30">
              {transcript.map((entry, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "text-sm px-3 py-1.5 rounded-lg max-w-[85%] shadow-sm",
                    entry.role === "agent"
                      ? "bg-blue-50 text-blue-900 mr-auto"
                      : "bg-gray-100 text-gray-900 ml-auto"
                  )}
                >
                  <span className="text-[10px] font-medium uppercase text-muted-foreground block mb-0.5">
                    {entry.role === "agent" ? agentName : "You"}
                  </span>
                  {entry.content}
                </div>
              ))}
            </div>
          )}

          {/* Call controls */}
          <div className="flex items-center gap-3">
            {isCallActive ? (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full w-12 h-12"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <MicOff className="w-5 h-5 text-red-500" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </Button>
                <Button
                  size="icon"
                  className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700"
                  onClick={handleEndCall}
                >
                  <PhoneOff className="w-6 h-6 text-white" />
                </Button>
              </>
            ) : (
              <Button
                size="lg"
                className="rounded-full px-8 bg-green-600 hover:bg-green-700"
                onClick={handleStartCall}
                disabled={isConnecting}
              >
                <Phone className="w-5 h-5 mr-2" />
                {isConnecting ? "Connecting..." : "Start Call"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
