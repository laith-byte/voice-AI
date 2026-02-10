"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface TranscriptEntry {
  role: "agent" | "user";
  content: string;
}

export function useRetellCall() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAgentTalking, setIsAgentTalking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null);

  const startCall = useCallback(async (agentId: string) => {
    try {
      // Get access token from backend
      const res = await fetch("/api/agents/create-web-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId }),
      });
      const { access_token } = await res.json();
      if (!access_token) throw new Error("No access token");

      // Dynamically import Retell Web SDK (client-side only)
      const { RetellWebClient } = await import("retell-client-js-sdk");
      const client = new RetellWebClient();
      clientRef.current = client;

      client.on("call_started", () => {
        setIsCallActive(true);
      });

      client.on("call_ended", () => {
        setIsCallActive(false);
        setIsAgentTalking(false);
      });

      client.on("agent_start_talking", () => {
        setIsAgentTalking(true);
      });

      client.on("agent_stop_talking", () => {
        setIsAgentTalking(false);
      });

      client.on("update", (update: { transcript?: TranscriptEntry[] }) => {
        if (update.transcript) {
          setTranscript(update.transcript);
        }
      });

      await client.startCall({ accessToken: access_token });
    } catch (error) {
      console.error("Failed to start call:", error);
      setIsCallActive(false);
    }
  }, []);

  const stopCall = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.stopCall();
      clientRef.current = null;
    }
    setIsCallActive(false);
    setIsAgentTalking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.stopCall();
      }
    };
  }, []);

  return {
    isCallActive,
    isAgentTalking,
    transcript,
    startCall,
    stopCall,
  };
}
