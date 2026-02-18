"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { LayoutTemplate, Settings, Zap } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: LayoutTemplate,
    title: "Choose Your Industry Template",
    description: "Pick from 32 pre-built agent templates designed for your specific industry. Each one is based on real business workflows.",
  },
  {
    number: "02",
    icon: Settings,
    title: "Customize Your Agent",
    description: "Adjust prompts, connect your calendar and CRM, upload your knowledge base, and configure call routing.",
  },
  {
    number: "03",
    icon: Zap,
    title: "Go Live in Minutes",
    description: "Assign a phone number and your AI agent starts answering calls immediately. Monitor, read transcripts, and refine.",
  },
];

export function HowItWorks() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} id="how-it-works" className="py-24 lg:py-32 bg-navy-950 relative overflow-hidden">
      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }} />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
            Go Live in Three Steps
          </h2>
          <p className="text-base text-gray-400 max-w-2xl mx-auto">
            From choosing a template to taking your first AI-handled call — the entire setup takes minutes, not months.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="relative text-center"
              >
                <span className="inline-block font-display text-5xl font-bold text-white/10 mb-4">
                  {step.number}
                </span>

                <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-5">
                  <Icon className="w-6 h-6 text-white" />
                </div>

                <h3 className="text-lg font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">{step.description}</p>

                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-24 left-[calc(50%+60px)] w-[calc(100%-120px)] h-px bg-gradient-to-r from-white/10 to-transparent" />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
