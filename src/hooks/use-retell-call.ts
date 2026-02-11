"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface TranscriptEntry {
  role: "agent" | "user";
  content: string;
}

interface StartCallOptions {
  captureDeviceId?: string;
}

export function useRetellCall() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAgentTalking, setIsAgentTalking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(null);
  const agentIdRef = useRef<string | null>(null);

  const syncCall = useCallback(async (callId: string, agentId: string) => {
    try {
      const res = await fetch("/api/agents/sync-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_id: callId, agent_id: agentId }),
      });
      if (!res.ok) {
        console.warn("Sync call attempt returned:", res.status);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Failed to sync call:", err);
      return false;
    }
  }, []);

  const startCall = useCallback(async (agentId: string, options?: StartCallOptions) => {
    try {
      // Get access token and call_id from backend
      const res = await fetch("/api/agents/create-web-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId }),
      });
      const { access_token, call_id } = await res.json();
      if (!access_token) throw new Error("No access token");

      // Store call_id and agent_id for post-call sync
      callIdRef.current = call_id;
      agentIdRef.current = agentId;

      // Dynamically import Retell Web SDK (client-side only)
      const { RetellWebClient } = await import("retell-client-js-sdk");
      const client = new RetellWebClient();
      clientRef.current = client;

      // Reset state for new call
      setTranscript([]);
      setIsMuted(false);

      client.on("call_started", () => {
        setIsCallActive(true);
      });

      client.on("call_ended", () => {
        setIsCallActive(false);
        setIsAgentTalking(false);

        // Sync call data after call ends
        const syncCallId = callIdRef.current;
        const syncAgentId = agentIdRef.current;
        if (syncCallId && syncAgentId) {
          // First attempt immediately
          syncCall(syncCallId, syncAgentId).then((success) => {
            if (!success) return;
            // Second attempt after 3s to capture post-call analysis
            setTimeout(() => {
              syncCall(syncCallId, syncAgentId);
            }, 3000);
          });
        }
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

      client.on("error", (error: unknown) => {
        console.error("Retell call error:", error);
        setIsCallActive(false);
        setIsAgentTalking(false);
      });

      // Build startCall config with optional device selection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const startConfig: any = {
        accessToken: access_token,
        sampleRate: 44100,
      };
      if (options?.captureDeviceId) {
        startConfig.captureDeviceId = options.captureDeviceId;
      }

      await client.startCall(startConfig);
    } catch (error) {
      console.error("Failed to start call:", error);
      setIsCallActive(false);
    }
  }, [syncCall]);

  const stopCall = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.stopCall();
      clientRef.current = null;
    }
    setIsCallActive(false);
    setIsAgentTalking(false);
  }, []);

  const mute = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.mute();
      setIsMuted(true);
    }
  }, []);

  const unmute = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.unmute();
      setIsMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      unmute();
    } else {
      mute();
    }
  }, [isMuted, mute, unmute]);

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
    isMuted,
    transcript,
    callId: callIdRef.current,
    startCall,
    stopCall,
    toggleMute,
  };
}
