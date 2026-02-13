"use client";

import { useEffect, useRef } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranscriptEntry {
  role: string;
  content: string;
}

interface TestCallTranscriptProps {
  transcript: TranscriptEntry[];
  callActive: boolean;
  agentName?: string;
}

export function TestCallTranscript({
  transcript,
  callActive,
  agentName = "AI Agent",
}: TestCallTranscriptProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Pulsing orb while active */}
      {callActive && (
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-primary flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Mic className="w-7 h-7 text-white" />
            </div>
            <div
              className="absolute -inset-2 rounded-full border-2 border-blue-400/40 animate-ping"
              style={{ animationDuration: "1.5s" }}
            />
            <div
              className="absolute -inset-4 rounded-full border border-blue-300/20 animate-ping"
              style={{ animationDuration: "2s" }}
            />
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 max-h-[300px] overflow-y-auto space-y-3 pr-1">
        {transcript.map((entry, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              entry.role === "agent" ? "justify-start" : "justify-end"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                entry.role === "agent"
                  ? "bg-gray-100 text-foreground rounded-bl-md"
                  : "bg-primary text-primary-foreground rounded-br-md"
              )}
            >
              <p className="text-[11px] font-medium opacity-70 mb-0.5">
                {entry.role === "agent" ? agentName : "You"}
              </p>
              {entry.content}
            </div>
          </div>
        ))}

        {/* Typing indicator while call is active and last message is from user */}
        {callActive &&
          transcript.length > 0 &&
          transcript[transcript.length - 1].role !== "agent" && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

        <div ref={endRef} />
      </div>
    </div>
  );
}
