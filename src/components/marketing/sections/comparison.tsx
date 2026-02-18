"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check, X, MessageSquare, Zap, GitBranch, PhoneCall, Database, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const rows = [
  { label: "Natural, human-like conversations", icon: MessageSquare },
  { label: "Fast setup with minimal configuration", icon: Zap },
  { label: "Handles edge cases & unexpected inputs", icon: GitBranch },
  { label: "Complex multi-turn & outbound use cases", icon: PhoneCall },
  { label: "Real-time function calling (CRM, calendar)", icon: Database },
  { label: "Post-call analytics & continuous QA", icon: BarChart3 },
];

function CellIcon({ type }: { type: "check" | "x" | "invaria" }) {
  if (type === "invaria")
    return (
      <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
        <Check className="w-3.5 h-3.5 text-emerald-500" />
      </div>
    );
  if (type === "check")
    return <Check className="w-4 h-4 text-gray-300" />;
  return <X className="w-4 h-4 text-gray-300/60" />;
}

export function Comparison() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-24 lg:py-32 bg-white relative overflow-hidden">
      <div className="absolute w-[500px] h-[500px] top-[-10%] left-[-15%] rounded-full bg-gradient-to-br from-teal-200/15 to-navy-200/5 blur-[120px]" />
      <div className="absolute w-[400px] h-[400px] bottom-[-10%] right-[-10%] rounded-full bg-gradient-to-tl from-navy-200/15 to-teal-100/5 blur-[120px]" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold text-navy-900/50 uppercase tracking-widest mb-3">Built to Scale</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight mb-4">
            What is Invaria Labs?
          </h2>
          <p className="text-base text-gray-500 max-w-2xl mx-auto">
            An LLM-powered, human-like, voice-first conversational AI platform — purpose-built for your industry.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="rounded-2xl border border-gray-200 overflow-hidden shadow-lg shadow-gray-200/50"
        >
          {/* Header */}
          <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-200">
            <div className="px-6 py-4 text-sm font-medium text-gray-500">Capability</div>
            <div className="px-4 py-4 text-center">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">1st Gen</p>
              <p className="text-sm font-medium text-gray-500 mt-0.5">IVR / Phone Tree</p>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">2nd Gen</p>
              <p className="text-sm font-medium text-gray-500 mt-0.5">NLP Chatbot</p>
            </div>
            <div className="px-4 py-4 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-navy-900 to-navy-950" />
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-transparent" />
              <div className="relative">
                <p className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider">3rd Gen</p>
                <p className="text-sm font-bold text-white mt-0.5">Invaria Labs</p>
              </div>
            </div>
          </div>

          {/* Rows */}
          {rows.map((row, i) => {
            const Icon = row.icon;
            return (
              <motion.div
                key={row.label}
                initial={{ opacity: 0, x: -10 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.06, duration: 0.4 }}
                className={cn(
                  "grid grid-cols-4 group transition-colors hover:bg-gray-50/80",
                  i < rows.length - 1 && "border-b border-gray-100"
                )}
              >
                <div className="px-6 py-4 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-navy-900/5 flex items-center justify-center shrink-0 group-hover:bg-navy-900/10 transition-colors">
                    <Icon className="w-3.5 h-3.5 text-navy-900/50" />
                  </div>
                  <span className="text-sm text-gray-600">{row.label}</span>
                </div>
                <div className="px-4 py-4 flex justify-center items-center">
                  <CellIcon type={i === 0 ? "check" : "x"} />
                </div>
                <div className="px-4 py-4 flex justify-center items-center">
                  <CellIcon type={i <= 1 ? "check" : "x"} />
                </div>
                <div className="px-4 py-4 flex justify-center items-center bg-teal-50/30 group-hover:bg-teal-50/50 transition-colors">
                  <CellIcon type="invaria" />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
