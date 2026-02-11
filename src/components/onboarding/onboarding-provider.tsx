"use client";

import { createContext, useContext } from "react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { OnboardingTutorial } from "./onboarding-tutorial";

interface OnboardingContextValue {
  retriggerTutorial: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboardingContext() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboardingContext must be used within OnboardingProvider");
  }
  return ctx;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { showTutorial, setShowTutorial, completeTutorial, retriggerTutorial } =
    useOnboarding();

  return (
    <OnboardingContext.Provider value={{ retriggerTutorial }}>
      {children}
      <OnboardingTutorial
        open={showTutorial}
        onOpenChange={setShowTutorial}
        onComplete={completeTutorial}
      />
    </OnboardingContext.Provider>
  );
}
