"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Check,
  Clock,
  MessageSquare,
  RotateCcw,
  ArrowRight,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TranscriptEntry {
  role: string;
  content: string;
}

interface TestScenario {
  title: string;
  description: string;
  opening: string;
}

interface TestCallReportProps {
  durationSeconds: number;
  transcript: TranscriptEntry[];
  scenarios: TestScenario[];
  onTryAgain: () => void;
  onMakeChanges: () => void;
  onContinue: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TestCallReport({
  durationSeconds,
  transcript,
  scenarios,
  onTryAgain,
  onMakeChanges,
  onContinue,
}: TestCallReportProps) {
  const turnCount = transcript.length;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-lg font-bold" style={{ fontFeatureSettings: '"tnum"' }}>
                {formatDuration(durationSeconds)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Turns</p>
              <p className="text-lg font-bold" style={{ fontFeatureSettings: '"tnum"' }}>
                {turnCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scenario checklist */}
      {scenarios.length > 0 && (
        <Card className="glass-card">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold mb-3">Scenario Checklist</h4>
            <div className="space-y-2">
              {scenarios.map((scenario, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm"
                >
                  <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-gray-400" />
                  </div>
                  <span className="text-muted-foreground">{scenario.title}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Try each scenario to make sure your agent handles them well.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Transcript preview */}
      {transcript.length > 0 && (
        <Card className="glass-card">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold mb-3">Call Transcript</h4>
            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
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
                      "max-w-[85%] rounded-xl px-3 py-2 text-xs",
                      entry.role === "agent"
                        ? "bg-gray-100 text-foreground"
                        : "bg-primary/10 text-foreground"
                    )}
                  >
                    <span className="font-medium opacity-60">
                      {entry.role === "agent" ? "Agent" : "You"}:
                    </span>{" "}
                    {entry.content}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3 pt-2">
        <Button variant="outline" onClick={onTryAgain} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Try Again
        </Button>
        <Button variant="outline" onClick={onMakeChanges} className="gap-2">
          <Wrench className="w-4 h-4" />
          Make Changes
        </Button>
        <Button onClick={onContinue} className="gap-2">
          Continue
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
