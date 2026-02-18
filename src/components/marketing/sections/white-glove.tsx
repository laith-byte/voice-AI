"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { Headphones, Bot, Wrench, FileText, FlaskConical, TrendingUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: Headphones,
    title: "Dedicated Onboarding Specialist",
    description: "A named point of contact who manages your entire setup from kickoff to go-live.",
    gradient: "from-teal-400 to-teal-500",
  },
  {
    icon: Bot,
    title: "Custom Agent Training",
    description: "We build and fine-tune your AI agents on your business knowledge, tone, and workflows.",
    gradient: "from-indigo-400 to-indigo-500",
  },
  {
    icon: Wrench,
    title: "Workflow & Integration Setup",
    description: "CRM connections, calendar sync, call routing rules, and SMS automations configured for you.",
    gradient: "from-gold-300 to-gold-400",
  },
  {
    icon: FileText,
    title: "Script & Prompt Engineering",
    description: "Professionally crafted call scripts and prompt logic optimized for your industry.",
    gradient: "from-teal-400 to-indigo-400",
  },
  {
    icon: FlaskConical,
    title: "Live Testing & QA",
    description: "We test every scenario end-to-end before your agents take a single real call.",
    gradient: "from-indigo-400 to-purple-400",
  },
  {
    icon: TrendingUp,
    title: "Ongoing Optimization",
    description: "Post-launch analytics reviews and agent tuning to continuously improve performance.",
    gradient: "from-gold-300 to-teal-400",
  },
];

export function WhiteGlove() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-24 lg:py-32 relative overflow-hidden">
      {/* Dark gradient background */}
      <div
        className="absolute inset-0 animate-gradient"
        style={{
          background: "linear-gradient(135deg, #0a0e2a 0%, #111842 20%, #0f172a 40%, #1a1f3d 55%, #0d1117 70%, #151b33 85%, #0a0e2a 100%)",
          backgroundSize: "300% 300%",
        }}
      />
      {/* Animated blobs */}
      <div className="absolute w-[50%] h-[50%] top-[-15%] right-[-5%] rounded-full bg-gradient-to-br from-teal-500/15 to-teal-400/5 blur-[100px] animate-blob" />
      <div className="absolute w-[40%] h-[40%] bottom-[-15%] left-[-10%] rounded-full bg-gradient-to-tr from-gold-400/10 to-gold-300/5 blur-[100px] animate-blob-reverse" />
      <div className="absolute w-[25%] h-[25%] top-[40%] left-[35%] rounded-full bg-gradient-to-r from-indigo-500/10 to-teal-500/5 blur-[80px] animate-blob-slow" />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-white/[0.07] border border-white/10 rounded-full px-4 py-1.5 mb-6 backdrop-blur-sm">
            <Headphones className="w-4 h-4 text-gold-400" />
            <span className="text-xs font-semibold text-gold-400 uppercase tracking-wider">White Glove</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-5">
            We Build It.{" "}
            <span className="bg-gradient-to-r from-gold-300 to-gold-400 bg-clip-text text-transparent">You Go Live.</span>
          </h2>
          <p className="text-white/50 max-w-2xl mx-auto text-base sm:text-lg">
            For clients who want a quality setup running as fast as possible. Our team handles every detail — so you can go live without lifting a finger.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {steps.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.5 }}
              className="group rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-6 transition-all duration-300 hover:bg-white/[0.08] hover:border-white/[0.15] hover:shadow-2xl hover:shadow-teal-500/5 hover:-translate-y-1"
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-lg transition-transform duration-300 group-hover:scale-110",
                  item.gradient
                )}>
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Step {i + 1}</span>
                  <h3 className="font-semibold text-white mt-0.5 mb-2">{item.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{item.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-14"
        >
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 text-navy-900 font-semibold text-sm transition-all hover:shadow-xl hover:shadow-gold-400/20 hover:scale-[1.02]"
          >
            Book a Consultation <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-white/30 text-xs mt-4">Free consultation — no commitment required</p>
        </motion.div>
      </div>
    </section>
  );
}
