"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  LayoutDashboard,
  Bot,
  BarChart3,
  MessageSquare,
  Megaphone,
  Settings,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Phone,
  TrendingUp,
  Search,
  Clock,
  BarChart,
  FileText,
  Headphones,
  Users,
  Calendar,
  Palette,
  Brain,
  type LucideIcon,
} from "lucide-react";

interface Step {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  gradient: string;
  highlights: { icon: LucideIcon; text: string }[];
}

const steps: Step[] = [
  {
    title: "Welcome to Your Portal",
    description:
      "Let's take a quick tour of your command center. In about 2 minutes, you'll know exactly where everything lives and how to get the most out of your AI agents.",
    icon: Sparkles,
    color: "text-violet-600",
    gradient: "from-violet-500/10 via-purple-500/5 to-fuchsia-500/10",
    highlights: [
      { icon: Clock, text: "Takes about 2 minutes" },
      { icon: Sparkles, text: "6 key features to explore" },
      { icon: ArrowRight, text: "Skip anytime if you prefer" },
    ],
  },
  {
    title: "Your Dashboard",
    description:
      "Your dashboard is mission control — a real-time snapshot of everything happening across your agents.",
    icon: LayoutDashboard,
    color: "text-blue-600",
    gradient: "from-blue-500/10 via-sky-500/5 to-cyan-500/10",
    highlights: [
      { icon: Phone, text: "Total calls & minutes at a glance" },
      { icon: TrendingUp, text: "30-day trend comparisons" },
      { icon: Clock, text: "Recent call activity feed" },
    ],
  },
  {
    title: "Your Agents",
    description:
      "Browse all your AI agents in one place. Each card shows live status and quick actions.",
    icon: Bot,
    color: "text-indigo-600",
    gradient: "from-indigo-500/10 via-blue-500/5 to-violet-500/10",
    highlights: [
      { icon: Search, text: "Search & filter agents instantly" },
      { icon: Bot, text: "Live status indicators per agent" },
      { icon: ArrowRight, text: "Click any card to drill into details" },
    ],
  },
  {
    title: "Agent Analytics",
    description:
      "Dive deep into each agent's performance. Understand what's working and where to optimize.",
    icon: BarChart3,
    color: "text-emerald-600",
    gradient: "from-emerald-500/10 via-green-500/5 to-teal-500/10",
    highlights: [
      { icon: BarChart, text: "Call volume & duration trends" },
      { icon: TrendingUp, text: "Outcome breakdowns & success rates" },
      { icon: Clock, text: "Peak hours & performance patterns" },
    ],
  },
  {
    title: "Conversations & Transcripts",
    description:
      "Every call is captured, transcribed, and analyzed. Find any conversation in seconds.",
    icon: MessageSquare,
    color: "text-sky-600",
    gradient: "from-sky-500/10 via-blue-500/5 to-indigo-500/10",
    highlights: [
      { icon: FileText, text: "Full transcripts with timestamps" },
      { icon: Headphones, text: "Listen to call recordings" },
      { icon: Brain, text: "AI-generated call summaries" },
    ],
  },
  {
    title: "Leads & Campaigns",
    description:
      "Manage your outreach from start to finish. Upload contacts, schedule campaigns, and track progress.",
    icon: Megaphone,
    color: "text-orange-600",
    gradient: "from-orange-500/10 via-amber-500/5 to-yellow-500/10",
    highlights: [
      { icon: Users, text: "Import & organize contact lists" },
      { icon: Calendar, text: "Schedule outbound campaigns" },
      { icon: TrendingUp, text: "Track completion & call outcomes" },
    ],
  },
  {
    title: "Settings & Configuration",
    description:
      "Fine-tune every detail. Agent behavior, widget appearance, and AI analysis — all configurable.",
    icon: Settings,
    color: "text-slate-600",
    gradient: "from-slate-500/10 via-gray-500/5 to-zinc-500/10",
    highlights: [
      { icon: Settings, text: "Agent voice & behavior settings" },
      { icon: Palette, text: "Widget layout & branding" },
      { icon: Brain, text: "AI summaries, tags & evaluations" },
    ],
  },
  {
    title: "You're All Set!",
    description:
      "You're ready to explore. Start from your dashboard and dive into any agent to see it all in action.",
    icon: CheckCircle2,
    color: "text-green-600",
    gradient: "from-green-500/10 via-emerald-500/5 to-teal-500/10",
    highlights: [
      { icon: Sparkles, text: "Your dashboard is waiting for you" },
      { icon: ArrowRight, text: "Click any agent card to get started" },
      { icon: MessageSquare, text: "Replay this tour via \"Take a Tour\" in your profile" },
    ],
  },
];

interface OnboardingTutorialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function OnboardingTutorial({
  open,
  onOpenChange,
  onComplete,
}: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const totalSteps = steps.length;
  const step = steps[currentStep];
  const Icon = step.icon;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  function handleNext() {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(0, s - 1));
  }

  function handleComplete() {
    setCurrentStep(0);
    onComplete();
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      setCurrentStep(0);
      onComplete();
      return;
    }
    onOpenChange(value);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg p-0 gap-0 overflow-hidden backdrop-blur-xl bg-white/95 border-white/30"
      >
        {/* Hero area with gradient background */}
        <div
          className={`relative bg-gradient-to-br ${step.gradient} px-6 pt-8 pb-6`}
        >
          {/* Step counter badge */}
          <div className="absolute top-4 right-4">
            <span className="text-xs font-medium text-muted-foreground bg-white/80 backdrop-blur-sm rounded-full px-2.5 py-1 border border-border/50">
              {currentStep + 1} / {totalSteps}
            </span>
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div
              className={`w-20 h-20 rounded-2xl bg-white/90 backdrop-blur-sm shadow-md border border-border/30 flex items-center justify-center transition-transform duration-300`}
            >
              <Icon className={`w-10 h-10 ${step.color}`} />
            </div>
          </div>

          {/* Title + Description */}
          <div className="text-center space-y-2">
            <DialogTitle className="text-xl font-semibold">
              {step.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {step.description}
            </DialogDescription>
          </div>
        </div>

        {/* Highlights */}
        <div className="px-6 py-5 space-y-3">
          {step.highlights.map((h, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg bg-gradient-to-br ${step.gradient} flex items-center justify-center shrink-0`}
              >
                <h.icon className={`w-4 h-4 ${step.color}`} />
              </div>
              <span className="text-sm text-foreground">{h.text}</span>
            </div>
          ))}
        </div>

        {/* Footer: dots + navigation */}
        <div className="px-6 pb-5 pt-2 flex items-center justify-between border-t border-border/50">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`rounded-full transition-all duration-300 ease-out ${
                  i === currentStep
                    ? `w-6 h-2 bg-current ${step.color} scale-100`
                    : i < currentStep
                      ? "w-2 h-2 bg-muted-foreground/40 hover:bg-muted-foreground/60"
                      : "w-2 h-2 bg-muted-foreground/20 hover:bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {!isLastStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleComplete}
                className="text-muted-foreground"
              >
                Skip tour
              </Button>
            )}
            {!isFirstStep && (
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {isLastStep ? (
                "Get Started"
              ) : (
                <>
                  Next
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
