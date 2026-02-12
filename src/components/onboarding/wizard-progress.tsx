"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface WizardProgressProps {
  currentStep: number; // 1-6
  totalSteps?: number; // default 6
}

const STEP_LABELS = [
  "Template",
  "Business Info",
  "Settings",
  "Call Rules",
  "Test Call",
  "Go Live",
];

export function WizardProgress({
  currentStep,
  totalSteps = 6,
}: WizardProgressProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="w-full mb-8">
      {/* Progress bar + circles */}
      <div className="relative flex items-center justify-between">
        {/* Connecting line (background) */}
        <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200 rounded-full" />
        {/* Connecting line (filled) */}
        <div
          className="absolute top-5 left-5 h-0.5 bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500 ease-out"
          style={{
            width:
              currentStep <= 1
                ? "0%"
                : `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
            maxWidth: "calc(100% - 40px)",
          }}
        />

        {steps.map((stepNum) => {
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          const isFuture = stepNum > currentStep;

          return (
            <div
              key={stepNum}
              className="relative z-10 flex flex-col items-center"
            >
              {/* Circle */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 border-2",
                  isCompleted &&
                    "bg-primary border-primary text-primary-foreground shadow-md",
                  isActive &&
                    "bg-white border-primary text-primary shadow-lg shadow-primary/20 ring-4 ring-primary/10",
                  isFuture &&
                    "bg-white border-gray-200 text-gray-400"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4.5 h-4.5" strokeWidth={2.5} />
                ) : (
                  stepNum
                )}
              </div>

              {/* Label (hidden on mobile) */}
              <span
                className={cn(
                  "hidden md:block mt-2 text-xs font-medium text-center whitespace-nowrap transition-colors duration-300",
                  isCompleted && "text-primary",
                  isActive && "text-primary font-semibold",
                  isFuture && "text-gray-400"
                )}
              >
                {STEP_LABELS[stepNum - 1] || `Step ${stepNum}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile: current step label */}
      <div className="md:hidden mt-3 text-center">
        <span className="text-sm font-medium text-primary">
          Step {currentStep} of {totalSteps}:{" "}
          {STEP_LABELS[currentStep - 1] || `Step ${currentStep}`}
        </span>
      </div>
    </div>
  );
}
