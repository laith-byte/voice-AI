"use client";

import { useState, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Zap,
  AudioWaveform,
  MessageCircle,
  Blocks,
  Wrench,
  Database,
  FlaskConical,
  ShieldCheck,
  BarChart3,
  Check,
  TrendingUp,
  Cpu,
} from "lucide-react";

interface HighlightTab {
  icon: React.ElementType;
  title: string;
  description: string;
  metrics?: { label: string; value: string; suffix?: string }[];
  features?: string[];
  visual?: "latency" | "waveform" | "turntaking" | "guardrails" | "functions" | "knowledge" | "simulation" | "qa" | "analytics";
}

interface HighlightBlock {
  overline: string;
  title: string;
  subtitle: string;
  tabs: HighlightTab[];
}

const blocks: HighlightBlock[] = [
  {
    overline: "Voice Quality",
    title: "Human-Quality Voice AI, Out of the Box",
    subtitle: "Proprietary voice AI orchestration delivering human-quality, low-latency phone conversations at scale.",
    tabs: [
      {
        icon: Zap,
        title: "Lowest Latency",
        description: "Sub-600ms response times keep conversations smooth and natural. Independent benchmarks confirm Invaria as one of the fastest voice AI platforms — callers never notice they're talking to an agent.",
        metrics: [
          { label: "Response Time", value: "<600", suffix: "ms" },
          { label: "Availability", value: "24/7", suffix: "" },
          { label: "Infra Capacity", value: "10K", suffix: "+" },
        ],
        features: [
          "Edge-optimized inference for sub-600ms latency",
          "Auto-scaling infrastructure handles traffic spikes",
          "Global PoPs minimize round-trip time",
        ],
        visual: "latency",
      },
      {
        icon: AudioWaveform,
        title: "Ultra Realistic Voice",
        description: "Voices built from real performance data and refined through human-guided training. Natural pacing, breathing patterns, and emotional tone that callers trust.",
        metrics: [
          { label: "Voice Models", value: "30", suffix: "+" },
          { label: "Languages", value: "32", suffix: "" },
          { label: "Caller Trust", value: "96", suffix: "%" },
        ],
        features: [
          "Natural breathing patterns and micro-pauses",
          "Emotional tone adaptation during conversations",
          "Industry-specific voice personas available",
        ],
        visual: "waveform",
      },
      {
        icon: MessageCircle,
        title: "Intelligent Turn-Taking",
        description: "Our proprietary turn-taking model knows when to stop, when to listen, and when to speak — handling interruptions, pauses, and cross-talk like a human agent would.",
        metrics: [
          { label: "Interruption Handling", value: "99", suffix: "%" },
          { label: "False Starts", value: "<1", suffix: "%" },
          { label: "Avg. Pause Detection", value: "80", suffix: "ms" },
        ],
        features: [
          "Handles cross-talk and simultaneous speech",
          "Detects intentional vs. unintentional pauses",
          "Adapts speaking pace to caller's rhythm",
        ],
        visual: "turntaking",
      },
    ],
  },
  {
    overline: "Platform",
    title: "Effortless to Use, Highly Configurable",
    subtitle: "Handle everything from routine requests to complex edge cases without trade-offs. Launch in days, not months.",
    tabs: [
      {
        icon: Blocks,
        title: "Agentic Framework with Guardrails",
        description: "Configure agent behavior with our visual framework. Built-in guardrails ensure your agent stays on-script while handling unexpected scenarios gracefully.",
        metrics: [
          { label: "Setup Time", value: "<1", suffix: " day" },
          { label: "Script Adherence", value: "99.5", suffix: "%" },
          { label: "Edge Cases Handled", value: "200", suffix: "+" },
        ],
        features: [
          "Guided conversation flow configuration",
          "Automatic fallback and escalation paths",
          "Custom guardrails per conversation topic",
        ],
        visual: "guardrails",
      },
      {
        icon: Wrench,
        title: "Real-Time Function Calling",
        description: "Add built-in or custom functions to call flows — book appointments, process payments, update CRM records, and transfer calls in real time.",
        metrics: [
          { label: "Built-in Functions", value: "25", suffix: "+" },
          { label: "Avg. Execution", value: "120", suffix: "ms" },
          { label: "API Integrations", value: "50", suffix: "+" },
        ],
        features: [
          "Book appointments and check availability live",
          "Process payments and send confirmations",
          "Update CRM records during the call",
        ],
        visual: "functions",
      },
      {
        icon: Database,
        title: "Knowledge Base with Auto-Sync",
        description: "Give your agent accurate, real-time answers backed by a knowledge base that automatically syncs with your latest content.",
        metrics: [
          { label: "Answer Accuracy", value: "98", suffix: "%" },
          { label: "Sync Frequency", value: "Real", suffix: "-time" },
          { label: "Source Types", value: "12", suffix: "+" },
        ],
        features: [
          "Upload PDFs, docs, or connect URLs",
          "Automatic re-indexing on content changes",
          "Semantic search with citation tracking",
        ],
        visual: "knowledge",
      },
    ],
  },
  {
    overline: "Quality Assurance",
    title: "Consistently High Quality, Continuously Improving",
    subtitle: "Every call is monitored, evaluated, and fed back into improving your agent's performance.",
    tabs: [
      {
        icon: FlaskConical,
        title: "Built-in Simulation Testing",
        description: "Test your agents across hundreds of real-world scenarios before going live. Validate behavior, accuracy, and edge-case handling at scale.",
        metrics: [
          { label: "Test Scenarios", value: "96", suffix: "+" },
          { label: "Pre-Launch Coverage", value: "99", suffix: "%" },
          { label: "Avg. Test Time", value: "< 5", suffix: " min" },
        ],
        features: [
          "Auto-generated test scenarios from call history",
          "Regression testing on agent updates",
          "Pass/fail scoring with detailed breakdowns",
        ],
        visual: "simulation",
      },
      {
        icon: ShieldCheck,
        title: "Continuous QA & Call Review",
        description: "Automatically review past calls to surface failure patterns and actionable insights. AI-powered evaluation scores every call so you can focus on what matters.",
        metrics: [
          { label: "Calls Reviewed", value: "100", suffix: "%" },
          { label: "Issue Detection", value: "95", suffix: "%" },
          { label: "Avg. Resolution", value: "< 24", suffix: " hrs" },
        ],
        features: [
          "AI-powered call scoring and grading",
          "Automatic pattern detection across calls",
          "Actionable improvement recommendations",
        ],
        visual: "qa",
      },
      {
        icon: BarChart3,
        title: "Performance Analytics Dashboard",
        description: "Custom charts and dashboards to analyze call outcomes, agent performance, and business impact. Track resolution rates, sentiment trends, and conversion metrics.",
        metrics: [
          { label: "Metrics Tracked", value: "40", suffix: "+" },
          { label: "Report Types", value: "12", suffix: "" },
          { label: "Data Retention", value: "365", suffix: " days" },
        ],
        features: [
          "Real-time dashboards with custom views",
          "Exportable reports for stakeholders",
          "Conversion funnel and sentiment tracking",
        ],
        visual: "analytics",
      },
    ],
  },
];

/* --- Visual illustrations for each tab --- */
function LatencyVisual({ dark }: { dark: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {[
        { label: "Invaria AI", value: 92, time: "580ms", highlight: true },
        { label: "Competitor A", value: 68, time: "1,200ms", highlight: false },
        { label: "Competitor B", value: 45, time: "1,800ms", highlight: false },
        { label: "Competitor C", value: 30, time: "2,400ms", highlight: false },
      ].map((bar, i) => (
        <div key={bar.label} className="flex items-center gap-3">
          <span className={cn("text-xs w-24 shrink-0 text-right font-medium", dark ? "text-gray-400" : "text-gray-500")}>{bar.label}</span>
          <div className={cn("flex-1 h-7 rounded-full overflow-hidden", dark ? "bg-white/5" : "bg-gray-100")}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${bar.value}%` }}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.8, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full flex items-center justify-end pr-2.5",
                bar.highlight
                  ? "bg-gradient-to-r from-teal-500 to-emerald-400"
                  : dark ? "bg-white/10" : "bg-gray-200"
              )}
            >
              <span className={cn("text-[10px] font-bold", bar.highlight ? "text-white" : dark ? "text-gray-400" : "text-gray-500")}>{bar.time}</span>
            </motion.div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WaveformVisual({ dark }: { dark: boolean }) {
  const heights = [20, 35, 25, 45, 30, 50, 28, 40, 22, 38, 15, 42, 32, 48, 20, 35, 25, 45, 30, 38];
  return (
    <div className="flex items-end justify-center gap-[3px] h-16">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 4 }}
          animate={{ height: h }}
          transition={{ delay: 0.2 + i * 0.04, duration: 0.5, ease: "easeOut" }}
          className={cn(
            "w-1.5 rounded-full",
            i < 10
              ? "bg-gradient-to-t from-navy-500 to-teal-400"
              : dark ? "bg-white/15" : "bg-gray-200"
          )}
        />
      ))}
    </div>
  );
}

function TurnTakingVisual({ dark }: { dark: boolean }) {
  const lines = [
    { speaker: "Caller", text: "Hi, I'd like to schedule an appointment for—", align: "left" as const },
    { speaker: "Agent", text: "Of course! I can help with that. What day works best?", align: "right" as const },
    { speaker: "Caller", text: "Actually, wait — can I first ask about...", align: "left" as const },
    { speaker: "Agent", text: "Sure, take your time. What would you like to know?", align: "right" as const },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      {lines.map((line, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: line.align === "left" ? -10 : 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + i * 0.2, duration: 0.4 }}
          className={cn("flex", line.align === "right" ? "justify-end" : "justify-start")}
        >
          <div className={cn(
            "max-w-[85%] rounded-xl px-3.5 py-2",
            line.align === "right"
              ? "bg-gradient-to-r from-navy-600 to-navy-500 text-white rounded-br-sm"
              : dark ? "bg-white/10 text-gray-300 rounded-bl-sm" : "bg-gray-100 text-gray-600 rounded-bl-sm"
          )}>
            <p className={cn("text-[10px] font-semibold mb-0.5", line.align === "right" ? "text-teal-300" : dark ? "text-gray-500" : "text-gray-400")}>{line.speaker}</p>
            <p className="text-xs leading-relaxed">{line.text}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function GuardrailsVisual({ dark }: { dark: boolean }) {
  const steps = [
    { label: "Greeting", status: "pass" },
    { label: "Identify Need", status: "pass" },
    { label: "Collect Info", status: "pass" },
    { label: "Off-Script?", status: "guard" },
    { label: "Redirect", status: "pass" },
    { label: "Resolve", status: "pass" },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {steps.map((step, i) => (
        <motion.div
          key={step.label}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + i * 0.1, duration: 0.3 }}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2",
            step.status === "guard"
              ? "bg-amber-500/10 border border-amber-500/20"
              : dark ? "bg-white/5" : "bg-gray-50"
          )}
        >
          <div className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
            step.status === "guard"
              ? "bg-amber-500/20"
              : "bg-emerald-500/20"
          )}>
            {step.status === "guard" ? (
              <Blocks className="w-3 h-3 text-amber-500" />
            ) : (
              <Check className="w-3 h-3 text-emerald-500" />
            )}
          </div>
          <span className={cn("text-xs font-medium", dark ? "text-gray-300" : "text-gray-600")}>{step.label}</span>
          {step.status === "guard" && (
            <span className="ml-auto text-[10px] font-semibold text-amber-500 uppercase">Guardrail Active</span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

function FunctionsVisual({ dark }: { dark: boolean }) {
  const functions = [
    { name: "bookAppointment()", status: "200 OK", time: "85ms" },
    { name: "checkAvailability()", status: "200 OK", time: "62ms" },
    { name: "sendConfirmation()", status: "200 OK", time: "110ms" },
    { name: "updateCRM()", status: "200 OK", time: "95ms" },
  ];
  return (
    <div className={cn("rounded-lg overflow-hidden border", dark ? "border-white/10" : "border-gray-200")}>
      <div className={cn("flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider", dark ? "bg-white/5 text-gray-500" : "bg-gray-50 text-gray-400")}>
        <Cpu className="w-3 h-3" /> Live Function Calls
      </div>
      {functions.map((fn, i) => (
        <motion.div
          key={fn.name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 + i * 0.15, duration: 0.3 }}
          className={cn("flex items-center gap-3 px-3 py-2.5 border-t", dark ? "border-white/5" : "border-gray-100")}
        >
          <code className={cn("text-xs font-mono flex-1", dark ? "text-teal-300" : "text-navy-600")}>{fn.name}</code>
          <span className="text-[10px] font-medium text-emerald-500">{fn.status}</span>
          <span className={cn("text-[10px]", dark ? "text-gray-500" : "text-gray-400")}>{fn.time}</span>
        </motion.div>
      ))}
    </div>
  );
}

function KnowledgeVisual({ dark }: { dark: boolean }) {
  const sources = [
    { type: "PDF", name: "Product Catalog 2026.pdf", status: "Synced" },
    { type: "URL", name: "help.acme.com/faq", status: "Synced" },
    { type: "DOC", name: "Return Policy v3.docx", status: "Synced" },
    { type: "API", name: "inventory.api/v2", status: "Live" },
  ];
  return (
    <div className="flex flex-col gap-2">
      {sources.map((src, i) => (
        <motion.div
          key={src.name}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + i * 0.1, duration: 0.3 }}
          className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5", dark ? "bg-white/5" : "bg-gray-50")}
        >
          <div className={cn(
            "w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0",
            src.type === "API" ? "bg-teal-500/15 text-teal-500" : "bg-navy-500/10 text-navy-500"
          )}>
            {src.type}
          </div>
          <span className={cn("text-xs font-medium flex-1 truncate", dark ? "text-gray-300" : "text-gray-600")}>{src.name}</span>
          <span className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full",
            src.status === "Live" ? "bg-teal-500/15 text-teal-500" : "bg-emerald-500/15 text-emerald-500"
          )}>{src.status}</span>
        </motion.div>
      ))}
    </div>
  );
}

function SimulationVisual({ dark }: { dark: boolean }) {
  const tests = [
    { name: "Happy path — book appointment", score: 100, status: "pass" },
    { name: "Caller interrupts mid-sentence", score: 98, status: "pass" },
    { name: "Unknown question handling", score: 95, status: "pass" },
    { name: "Multi-intent request", score: 92, status: "pass" },
    { name: "Language switch mid-call", score: 97, status: "pass" },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {tests.map((test, i) => (
        <motion.div
          key={test.name}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + i * 0.1, duration: 0.3 }}
          className={cn("flex items-center gap-3 rounded-lg px-3 py-2", dark ? "bg-white/5" : "bg-gray-50")}
        >
          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className={cn("text-xs flex-1 truncate", dark ? "text-gray-300" : "text-gray-600")}>{test.name}</span>
          <div className={cn("flex items-center gap-1.5")}>
            <div className={cn("w-12 h-1.5 rounded-full overflow-hidden", dark ? "bg-white/10" : "bg-gray-200")}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${test.score}%` }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                className="h-full rounded-full bg-emerald-500"
              />
            </div>
            <span className="text-[10px] font-bold text-emerald-500 w-8 text-right">{test.score}%</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function QAVisual({ dark }: { dark: boolean }) {
  const calls = [
    { id: "#4,291", score: "A+", sentiment: "Positive", duration: "3:42" },
    { id: "#4,290", score: "A", sentiment: "Positive", duration: "5:18" },
    { id: "#4,289", score: "A+", sentiment: "Neutral", duration: "2:05" },
    { id: "#4,288", score: "B+", sentiment: "Positive", duration: "4:33" },
  ];
  return (
    <div className={cn("rounded-lg overflow-hidden border", dark ? "border-white/10" : "border-gray-200")}>
      <div className={cn("grid grid-cols-4 gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider", dark ? "bg-white/5 text-gray-500" : "bg-gray-50 text-gray-400")}>
        <span>Call</span><span>Score</span><span>Sentiment</span><span>Duration</span>
      </div>
      {calls.map((call, i) => (
        <motion.div
          key={call.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 + i * 0.1, duration: 0.3 }}
          className={cn("grid grid-cols-4 gap-2 px-3 py-2.5 border-t", dark ? "border-white/5" : "border-gray-100")}
        >
          <span className={cn("text-xs font-mono", dark ? "text-gray-300" : "text-gray-600")}>{call.id}</span>
          <span className={cn("text-xs font-bold", call.score === "A+" ? "text-emerald-500" : call.score === "A" ? "text-teal-500" : "text-amber-500")}>{call.score}</span>
          <span className={cn("text-xs", dark ? "text-gray-400" : "text-gray-500")}>{call.sentiment}</span>
          <span className={cn("text-xs", dark ? "text-gray-500" : "text-gray-400")}>{call.duration}</span>
        </motion.div>
      ))}
    </div>
  );
}

function AnalyticsVisual({ dark }: { dark: boolean }) {
  const data = [35, 42, 38, 55, 48, 62, 58, 72, 68, 80, 75, 88];
  const maxVal = Math.max(...data);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className={cn("text-xs font-medium", dark ? "text-gray-400" : "text-gray-500")}>Resolution Rate</p>
          <p className={cn("text-lg font-bold", dark ? "text-white" : "text-navy-900")}>88% <span className="text-emerald-500 text-xs font-semibold ml-1"><TrendingUp className="w-3 h-3 inline" /> +12%</span></p>
        </div>
        <div className="text-right">
          <p className={cn("text-xs font-medium", dark ? "text-gray-400" : "text-gray-500")}>This Month</p>
          <p className={cn("text-lg font-bold", dark ? "text-white" : "text-navy-900")}>4,291 <span className={cn("text-xs font-normal", dark ? "text-gray-500" : "text-gray-400")}>calls</span></p>
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-16">
        {data.map((val, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${(val / maxVal) * 100}%` }}
            transition={{ delay: 0.3 + i * 0.05, duration: 0.5, ease: "easeOut" }}
            className={cn(
              "flex-1 rounded-sm",
              i === data.length - 1
                ? "bg-gradient-to-t from-teal-500 to-emerald-400"
                : dark ? "bg-white/10" : "bg-navy-100"
            )}
          />
        ))}
      </div>
      <div className={cn("flex justify-between text-[10px]", dark ? "text-gray-600" : "text-gray-300")}>
        <span>Jan</span><span>Jun</span><span>Dec</span>
      </div>
    </div>
  );
}

const visualMap: Record<string, React.FC<{ dark: boolean }>> = {
  latency: LatencyVisual,
  waveform: WaveformVisual,
  turntaking: TurnTakingVisual,
  guardrails: GuardrailsVisual,
  functions: FunctionsVisual,
  knowledge: KnowledgeVisual,
  simulation: SimulationVisual,
  qa: QAVisual,
  analytics: AnalyticsVisual,
};

/* --- Main block component --- */
function HighlightBlockSection({ block, dark }: { block: HighlightBlock; dark: boolean }) {
  const [activeTab, setActiveTab] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const activeData = block.tabs[activeTab];

  return (
    <section ref={ref} className={cn("py-24 lg:py-32 relative overflow-hidden", dark ? "bg-navy-950" : "bg-white")}>
      {/* Noise overlay for dark sections */}
      {dark && (
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />
      )}
      {/* Gradient accent */}
      {dark && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-navy-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />}

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className={cn(
            "inline-flex items-center gap-2 rounded-full px-3.5 py-1 mb-5 text-xs font-semibold uppercase tracking-widest",
            dark ? "bg-white/5 text-teal-400" : "bg-navy-50 text-navy-600"
          )}>
            {block.overline}
          </div>
          <h2 className={cn("font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-4 leading-tight", dark ? "text-white" : "text-navy-900")}>
            {block.title}
          </h2>
          <p className={cn("text-base lg:text-lg max-w-2xl", dark ? "text-gray-400" : "text-gray-500")}>
            {block.subtitle}
          </p>
        </motion.div>

        {/* Tab layout */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="grid lg:grid-cols-[300px_1fr] gap-6 lg:gap-8"
        >
          {/* Tab navigation */}
          <div className="flex flex-row lg:flex-col gap-2">
            {block.tabs.map((tab, i) => {
              const Icon = tab.icon;
              const isActive = activeTab === i;
              return (
                <button
                  key={tab.title}
                  onClick={() => setActiveTab(i)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-all duration-200 w-full overflow-hidden",
                    isActive
                      ? dark ? "bg-white/10 text-white shadow-lg shadow-black/10" : "bg-navy-950 text-white shadow-lg shadow-navy-950/20"
                      : dark ? "text-gray-400 hover:text-white hover:bg-white/5" : "text-gray-500 hover:text-navy-900 hover:bg-gray-50"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId={`tab-highlight-${block.overline}`}
                      className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-full", dark ? "bg-teal-400" : "bg-teal-400")}
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <div className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-all",
                    isActive
                      ? dark ? "bg-white/10" : "bg-white/15"
                      : dark ? "bg-white/5 group-hover:bg-white/10" : "bg-gray-100 group-hover:bg-gray-200"
                  )}>
                    <Icon className={cn("w-[18px] h-[18px] transition-colors", isActive ? "text-white" : dark ? "text-gray-500" : "text-gray-400")} />
                  </div>
                  <span className="text-sm font-medium hidden sm:inline">{tab.title}</span>
                </button>
              );
            })}
          </div>

          {/* Tab content panel */}
          <div className={cn(
            "rounded-2xl border p-6 sm:p-8 lg:p-8 min-h-[340px]",
            dark ? "border-white/10 bg-white/[0.03]" : "border-gray-200 bg-gradient-to-br from-gray-50 to-white"
          )}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                {/* Title row */}
                <div className="flex items-center gap-3 mb-3">
                  {(() => {
                    const Icon = activeData.icon;
                    return (
                      <div className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-xl",
                        dark ? "bg-gradient-to-br from-teal-500/20 to-navy-600/20" : "bg-gradient-to-br from-navy-100 to-navy-50"
                      )}>
                        <Icon className={cn("w-5 h-5", dark ? "text-teal-400" : "text-navy-700")} />
                      </div>
                    );
                  })()}
                  <h3 className={cn("text-lg font-bold", dark ? "text-white" : "text-navy-900")}>
                    {activeData.title}
                  </h3>
                </div>

                {/* Description */}
                <p className={cn("text-sm leading-relaxed mb-6 max-w-xl", dark ? "text-gray-400" : "text-gray-500")}>
                  {activeData.description}
                </p>

                {/* Metrics row */}
                {activeData.metrics && (
                  <div className={cn(
                    "grid grid-cols-3 gap-3 mb-6 rounded-xl p-4",
                    dark ? "bg-white/[0.03] border border-white/5" : "bg-white border border-gray-100 shadow-sm"
                  )}>
                    {activeData.metrics.map((metric, i) => (
                      <motion.div
                        key={metric.label}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15 + i * 0.1, duration: 0.3 }}
                        className="text-center"
                      >
                        <p className={cn("text-xl sm:text-2xl font-bold tracking-tight", dark ? "text-white" : "text-navy-900")}>
                          {metric.value}
                          <span className={cn("text-sm font-semibold", dark ? "text-teal-400" : "text-teal-600")}>{metric.suffix}</span>
                        </p>
                        <p className={cn("text-[11px] mt-0.5", dark ? "text-gray-500" : "text-gray-400")}>{metric.label}</p>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Two-column: features + visual */}
                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Feature bullets */}
                  {activeData.features && (
                    <div className="flex flex-col gap-2.5">
                      {activeData.features.map((feat, i) => (
                        <motion.div
                          key={feat}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + i * 0.1, duration: 0.3 }}
                          className="flex items-start gap-2.5"
                        >
                          <div className={cn("mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0", dark ? "bg-teal-500/15" : "bg-emerald-500/10")}>
                            <Check className={cn("w-2.5 h-2.5", dark ? "text-teal-400" : "text-emerald-600")} />
                          </div>
                          <span className={cn("text-xs leading-relaxed", dark ? "text-gray-300" : "text-gray-600")}>{feat}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Visual illustration */}
                  {activeData.visual && visualMap[activeData.visual] && (
                    <div>
                      {(() => {
                        const Visual = visualMap[activeData.visual!];
                        return <Visual dark={dark} />;
                      })()}
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function Highlights() {
  return (
    <>
      <HighlightBlockSection block={blocks[0]} dark={false} />
      <HighlightBlockSection block={blocks[1]} dark={true} />
      <HighlightBlockSection block={blocks[2]} dark={false} />
    </>
  );
}
