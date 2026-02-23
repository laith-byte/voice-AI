"use client";

import { useEffect, useRef } from "react";
import { Phone, PhoneOff, Mic, MicOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRetellCall } from "@/hooks/use-retell-call";
import { cn } from "@/lib/utils";

interface PromptTreeTestPanelProps {
  agentId: string;
  onClose: () => void;
}

export function PromptTreeTestPanel({ agentId, onClose }: PromptTreeTestPanelProps) {
  const {
    isCallActive,
    isAgentTalking,
    isMuted,
    transcript,
    startCall,
    stopCall,
    toggleMute,
  } = useRetellCall();
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  function handleClose() {
    if (isCallActive) stopCall();
    onClose();
  }

  return (
    <div className="w-80 border-l bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold text-gray-900">Test Call</h3>
        <button
          onClick={handleClose}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Status */}
      <div className="px-4 py-3 border-b bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all",
              isCallActive
                ? isAgentTalking
                  ? "bg-blue-500 shadow-lg shadow-blue-500/30 animate-pulse"
                  : "bg-blue-400 shadow-md shadow-blue-400/20"
                : "bg-gray-200"
            )}
          >
            <Phone className={cn("size-4", isCallActive ? "text-white" : "text-gray-500")} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {isCallActive
                ? isAgentTalking
                  ? "Agent speaking..."
                  : "Listening..."
                : "Ready to test"}
            </p>
            <p className="text-xs text-gray-500">
              {isCallActive ? "Live conversation" : "Click Start to begin"}
            </p>
          </div>
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {transcript.length === 0 && !isCallActive && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">
              Start a test call to see the live conversation here
            </p>
          </div>
        )}
        {transcript.length === 0 && isCallActive && (
          <div className="text-center py-8">
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
              "text-sm px-3 py-2 rounded-lg max-w-[90%]",
              entry.role === "agent"
                ? "bg-blue-50 text-blue-900 mr-auto"
                : "bg-gray-100 text-gray-900 ml-auto"
            )}
          >
            <span className="text-[10px] font-semibold uppercase text-gray-400 block mb-0.5">
              {entry.role === "agent" ? "Agent" : "You"}
            </span>
            {entry.content}
          </div>
        ))}
        <div ref={transcriptEndRef} />
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t bg-gray-50/50">
        {isCallActive ? (
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full w-10 h-10"
              onClick={toggleMute}
            >
              {isMuted ? (
                <MicOff className="size-4 text-red-500" />
              ) : (
                <Mic className="size-4" />
              )}
            </Button>
            <Button
              size="icon"
              className="rounded-full w-12 h-12 bg-red-600 hover:bg-red-700"
              onClick={stopCall}
            >
              <PhoneOff className="size-5 text-white" />
            </Button>
          </div>
        ) : (
          <Button
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => startCall(agentId)}
          >
            <Phone className="size-4" />
            Start Test Call
          </Button>
        )}
      </div>
    </div>
  );
}
