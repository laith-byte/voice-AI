"use client";

import { useState } from "react";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRetellCall } from "@/hooks/use-retell-call";
import { cn } from "@/lib/utils";

interface PrototypeCallDialogProps {
  agentId: string;
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrototypeCallDialog({
  agentId,
  agentName,
  open,
  onOpenChange,
}: PrototypeCallDialogProps) {
  const { isCallActive, isAgentTalking, transcript, startCall, stopCall } =
    useRetellCall();
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  async function handleStartCall() {
    setIsConnecting(true);
    await startCall(agentId);
    setIsConnecting(false);
  }

  function handleEndCall() {
    stopCall();
  }

  function handleClose(value: boolean) {
    if (!value && isCallActive) {
      stopCall();
    }
    onOpenChange(value);
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
                    "text-sm px-3 py-1.5 rounded-lg max-w-[85%]",
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
                  onClick={() => setIsMuted(!isMuted)}
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
