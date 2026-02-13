"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface TestScenario {
  title: string;
  description: string;
  opening: string;
}

interface TestCallCoachingProps {
  scenarios: TestScenario[];
  selectedScenario: number | null;
  onSelect: (index: number) => void;
}

export function TestCallCoaching({
  scenarios,
  selectedScenario,
  onSelect,
}: TestCallCoachingProps) {
  if (!scenarios.length) return null;

  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-sm">Test Call Scenarios</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Choose a scenario below and use the suggested opening line when the
          call starts. This helps you test how your agent handles real
          situations.
        </p>

        <div className="space-y-3">
          {scenarios.map((scenario, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                "w-full text-left rounded-lg border p-4 transition-all duration-200",
                selectedScenario === i
                  ? "border-primary bg-primary/[0.04] shadow-sm"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                    selectedScenario === i
                      ? "bg-primary/10 text-primary"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-medium">{scenario.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {scenario.description}
                  </p>
                  {selectedScenario === i && (
                    <div className="mt-3 bg-primary/[0.06] rounded-md px-3 py-2 border border-primary/10">
                      <p className="text-[10px] font-medium text-primary/70 uppercase tracking-wide mb-1">
                        Suggested opening line
                      </p>
                      <p className="text-sm text-foreground italic">
                        &ldquo;{scenario.opening}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
