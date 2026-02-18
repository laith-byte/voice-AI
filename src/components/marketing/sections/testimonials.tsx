"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Quote } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const caseStudies = [
  {
    metric: "35%",
    metricLabel: "Reduction in no-shows",
    quote: "We were missing 40% of calls during lunch and after hours. Since deploying Invaria, we haven't missed a single appointment request. No-show rate dropped by 35% thanks to automated reminders.",
    name: "Dr. Sarah Chen",
    title: "Office Manager",
    company: "Bright Smiles Dental",
    industry: "Healthcare",
    initials: "SC",
    accent: "from-teal-400 to-teal-500",
    accentBorder: "border-teal-400/30",
  },
  {
    metric: "3x",
    metricLabel: "More consultations booked",
    quote: "Client intake used to take our paralegals 20 minutes per call. Now the AI handles screening 24/7, and we only spend time on qualified prospects. Consultation bookings tripled.",
    name: "Marcus Williams",
    title: "Managing Partner",
    company: "Williams & Associates",
    industry: "Legal",
    initials: "MW",
    accent: "from-indigo-400 to-indigo-500",
    accentBorder: "border-indigo-400/30",
  },
  {
    metric: "1 week",
    metricLabel: "To positive ROI",
    quote: "As a small HVAC company, we couldn't afford a full-time dispatcher. Invaria handles after-hours calls, dispatches our tech, and books follow-ups. Paid for itself in the first week.",
    name: "Lisa Rodriguez",
    title: "Owner",
    company: "Rodriguez HVAC",
    industry: "Home Services",
    initials: "LR",
    accent: "from-gold-300 to-gold-400",
    accentBorder: "border-gold-400/30",
  },
];

export function Testimonials() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-24 lg:py-32 bg-navy-950 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }} />
      <div className="absolute w-[400px] h-[400px] top-[-10%] right-[-5%] rounded-full bg-gradient-to-bl from-teal-500/10 to-indigo-500/5 blur-[100px]" />
      <div className="absolute w-[300px] h-[300px] bottom-[-10%] left-[-5%] rounded-full bg-gradient-to-tr from-gold-400/10 to-navy-400/5 blur-[100px]" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-14"
        >
          <div>
            <p className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-3">Proven Impact</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Real Results, Real Conversations
            </h2>
          </div>
          <Link href="/contact" className="text-sm font-medium text-white/60 hover:text-white transition-colors flex items-center gap-1 shrink-0">
            See all stories <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {caseStudies.map((study, i) => (
            <motion.div
              key={study.name}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className={cn(
                "group rounded-xl border bg-white/[0.03] backdrop-blur-sm p-7 flex flex-col relative overflow-hidden transition-all duration-300 hover:bg-white/[0.06] hover:-translate-y-1",
                study.accentBorder
              )}
            >
              {/* Accent gradient top bar */}
              <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", study.accent)} />

              {/* Quote icon */}
              <Quote className="w-8 h-8 text-white/[0.06] mb-4" />

              {/* Metric */}
              <div className="mb-5">
                <span className={cn("text-4xl font-bold bg-gradient-to-r bg-clip-text text-transparent", study.accent)}>
                  {study.metric}
                </span>
                <p className="text-xs text-gray-400 mt-1.5">{study.metricLabel}</p>
              </div>

              {/* Quote */}
              <p className="text-sm text-gray-300 leading-relaxed mb-6 flex-1">&ldquo;{study.quote}&rdquo;</p>

              {/* Attribution */}
              <div className="border-t border-white/10 pt-4 flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0 text-white text-xs font-bold", study.accent)}>
                  {study.initials}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{study.name}</p>
                  <p className="text-xs text-gray-400">{study.title}, {study.company}</p>
                </div>
              </div>

              {/* Industry badge */}
              <span className={cn("absolute top-5 right-5 text-[10px] uppercase tracking-wider font-semibold border rounded-full px-2.5 py-0.5", study.accentBorder, "text-white/40")}>{study.industry}</span>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-600 mt-8 italic">* Placeholder case studies for demonstration purposes</p>
      </div>
    </section>
  );
}
