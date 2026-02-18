"use client";

import { useRef, ReactNode } from "react";
import { CTASection } from "@/components/marketing/sections/cta-section";
import { motion, useInView } from "framer-motion";
import {
  Phone, MessageSquare, Calendar, PhoneForwarded, BookOpen, Link2,
  MessageCircle, BarChart3, Globe, GitBranch, ShieldCheck, UserCheck,
  ArrowRight, X, Check, Zap, Users, Lock, Sparkles, Workflow, Activity,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const noiseUrl = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`;

const beforeAfter = [
  { before: "30% of calls go to voicemail", after: "100% of calls answered instantly" },
  { before: "2+ hour lead response time", after: "Under 10 seconds, 24/7" },
  { before: "Manual appointment scheduling", after: "Automated booking with calendar sync" },
  { before: "No after-hours support", after: "Full AI coverage, nights and weekends" },
  { before: "Paper-based call notes", after: "Automatic transcripts + CRM logging" },
  { before: "English-only phone support", after: "30+ languages supported" },
];

function AnimatedSection({ children, className }: { children: (inView: boolean) => ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <section ref={ref} className={className}>
      {children(inView)}
    </section>
  );
}

function LightBullet({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
        <Check className="w-3 h-3 text-teal-600" />
      </div>
      <div>
        <p className="text-sm font-medium text-navy-900">{title}</p>
        <p className="text-sm text-gray-500">{desc}</p>
      </div>
    </div>
  );
}

function DarkBullet({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 w-5 h-5 rounded-full bg-teal-400/10 flex items-center justify-center shrink-0">
        <Check className="w-3 h-3 text-teal-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-sm text-white/50">{desc}</p>
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  const beforeAfterRef = useRef(null);
  const beforeAfterInView = useInView(beforeAfterRef, { once: true, margin: "-100px" });

  return (
    <main>
      {/* Hero */}
      <section className="relative pt-[72px]">
        <div className="mx-3 sm:mx-4 lg:mx-6">
          <div className="relative overflow-hidden rounded-2xl lg:rounded-3xl py-24 lg:py-32">
            <div
              className="absolute inset-0 animate-gradient"
              style={{
                background: "linear-gradient(135deg, #0a0e2a 0%, #111842 20%, #0f172a 40%, #1a1f3d 55%, #0d1117 70%, #151b33 85%, #0a0e2a 100%)",
                backgroundSize: "300% 300%",
              }}
            />
            <div className="absolute w-[50%] h-[50%] top-[-15%] right-[-10%] rounded-full bg-gradient-to-br from-navy-700/40 to-navy-500/20 blur-[80px] animate-blob" />
            <div className="absolute w-[40%] h-[40%] bottom-[-15%] left-[-10%] rounded-full bg-gradient-to-tr from-navy-800/50 to-indigo-600/20 blur-[80px] animate-blob-reverse" />
            <div className="absolute w-[30%] h-[30%] top-[25%] left-[30%] rounded-full bg-gradient-to-r from-navy-600/15 to-indigo-500/10 blur-[60px] animate-blob-slow" />
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: noiseUrl }} />
            <div className="relative z-10 mx-auto max-w-4xl px-6 sm:px-10 text-center">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-white/50 mb-6"
              >
                Platform Capabilities
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-6"
              >
                The Complete Voice AI Platform
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-base sm:text-lg text-white/60 max-w-2xl mx-auto mb-10"
              >
                Everything your business needs to automate phone operations — from answering calls to closing deals. All features included in every plan.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="flex items-center justify-center gap-4"
              >
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-navy-900 transition-all hover:bg-gray-100 hover:scale-[1.02]"
                >
                  Book a Demo <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/20"
                >
                  View Pricing
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 1: 24/7 Calls */}
      <AnimatedSection className="py-20 lg:py-28 bg-white relative overflow-hidden">
        {(inView) => (
          <>
            <div className="absolute w-[500px] h-[500px] top-[-10%] right-[-15%] rounded-full bg-gradient-to-br from-teal-200/20 to-teal-400/5 blur-[120px]" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Text */}
                <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
                  <div className="inline-flex items-center gap-2 bg-navy-900/5 border border-navy-900/10 rounded-full px-4 py-1.5 mb-5">
                    <Phone className="w-4 h-4 text-navy-900" />
                    <span className="text-xs font-semibold text-navy-900 uppercase tracking-wider">Always On</span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight mb-4">
                    24/7 Inbound &<br />Outbound Calls
                  </h2>
                  <p className="text-gray-500 mb-8 max-w-lg">
                    Your AI agents answer every call instantly, day or night. No hold music, no voicemail, no missed opportunities. Run outbound campaigns to follow up on leads, confirm appointments, and collect feedback.
                  </p>
                  <div className="space-y-4">
                    <LightBullet title="Zero wait time" desc="Calls answered in under 1 second — no hold music, no IVR menus." />
                    <LightBullet title="Handle 100+ concurrent calls" desc="Scale instantly during peak hours without adding staff." />
                    <LightBullet title="Outbound campaigns" desc="Automated follow-ups, appointment reminders, and feedback collection." />
                    <LightBullet title="After-hours & holidays" desc="Full coverage when your team is offline — nights, weekends, every holiday." />
                  </div>
                </motion.div>
                {/* Visual: Live Call Dashboard */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }}>
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Live Call Monitor</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-semibold text-emerald-600">Online</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-px bg-gray-100">
                      {[
                        { value: "847", label: "Handled Today", color: "text-navy-900" },
                        { value: "<1s", label: "Avg Wait", color: "text-teal-600" },
                        { value: "24/7", label: "Availability", color: "text-navy-900" },
                      ].map((s) => (
                        <div key={s.label} className="bg-white px-4 py-4 text-center">
                          <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 space-y-2">
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-3">Active Calls</p>
                      {[
                        { num: "+1 (555) 234-8901", dur: "2:34", type: "Inbound" },
                        { num: "+1 (555) 891-2345", dur: "0:45", type: "Outbound" },
                        { num: "+1 (555) 167-8902", dur: "1:12", type: "Inbound" },
                        { num: "+1 (555) 443-7721", dur: "0:18", type: "Outbound" },
                      ].map((c, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50">
                          <div className="flex items-center gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-medium text-gray-700">{c.num}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", c.type === "Inbound" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600")}>{c.type}</span>
                            <span className="text-[10px] font-mono text-gray-400 w-8 text-right">{c.dur}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatedSection>

      {/* FEATURE 2: Natural Conversations */}
      <AnimatedSection className="py-20 lg:py-28 bg-navy-950 relative overflow-hidden">
        {(inView) => (
          <>
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: noiseUrl }} />
            <div className="absolute w-[400px] h-[400px] top-[-10%] left-[-10%] rounded-full bg-gradient-to-br from-teal-500/10 to-indigo-500/5 blur-[100px]" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Visual: Conversation Transcript */}
                <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }} className="order-2 lg:order-1">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5 sm:p-6 space-y-4">
                    {[
                      { role: "caller" as const, text: "Hi, I need to reschedule my appointment from Tuesday to later this week." },
                      { role: "ai" as const, text: "Of course! I can help you with that. Let me pull up your appointment. I have openings on Thursday at 2:00 PM and Friday at 10:30 AM. Which works better for you?" },
                      { role: "caller" as const, text: "Thursday at 2 works perfectly." },
                      { role: "ai" as const, text: "Great, you\u2019re all set for Thursday at 2:00 PM with Dr. Martinez. I\u2019ll send you a confirmation text right now. Is there anything else I can help with?" },
                    ].map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={inView ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
                        className={cn("flex gap-3", msg.role === "ai" && "flex-row-reverse")}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1",
                          msg.role === "ai" ? "bg-teal-500/20" : "bg-white/10"
                        )}>
                          {msg.role === "ai" ? <Sparkles className="w-3.5 h-3.5 text-teal-400" /> : <Users className="w-3.5 h-3.5 text-white/50" />}
                        </div>
                        <div className={cn(
                          "rounded-xl px-4 py-3 max-w-[85%]",
                          msg.role === "ai" ? "rounded-tr-none bg-teal-500/10 border border-teal-500/20" : "rounded-tl-none bg-white/[0.06]"
                        )}>
                          <p className="text-sm text-white/70 leading-relaxed">{msg.text}</p>
                        </div>
                      </motion.div>
                    ))}
                    <div className="text-center pt-3">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-white/25 bg-white/5 rounded-full px-3 py-1">
                        <Sparkles className="w-3 h-3" /> Entirely AI-Powered
                      </span>
                    </div>
                  </div>
                </motion.div>
                {/* Text */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }} className="order-1 lg:order-2">
                  <div className="inline-flex items-center gap-2 bg-white/[0.07] border border-white/10 rounded-full px-4 py-1.5 mb-5">
                    <MessageSquare className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Voice AI</span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                    Natural, Human-Like Conversations
                  </h2>
                  <p className="text-white/50 mb-8 max-w-lg">
                    Powered by the latest large language models with natural speech synthesis. Callers often can&apos;t tell they&apos;re speaking with AI. Context-aware, empathetic, and always on-brand.
                  </p>
                  <div className="space-y-4">
                    <DarkBullet title="Latest AI models" desc="GPT-4o, Claude, and proprietary models for natural dialogue." />
                    <DarkBullet title="Emotional intelligence" desc="Detects caller tone and adjusts responses appropriately." />
                    <DarkBullet title="Handles interruptions" desc="Manages overlapping speech, corrections, and topic changes." />
                    <DarkBullet title="Brand consistency" desc="Always matches your company's tone, terminology, and personality." />
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatedSection>

      {/* FEATURE 3: Appointment Scheduling */}
      <AnimatedSection className="py-20 lg:py-28 bg-white relative overflow-hidden">
        {(inView) => (
          <>
            <div className="absolute w-[400px] h-[400px] bottom-[-10%] left-[-10%] rounded-full bg-gradient-to-tr from-navy-200/20 to-teal-100/10 blur-[120px]" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Visual: Calendar Booking */}
                <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }}>
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Appointment Booking</span>
                      <span className="text-[10px] font-medium text-gray-400">February 2026</span>
                    </div>
                    <div className="p-5">
                      <div className="grid grid-cols-5 gap-2 mb-4">
                        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                          <div key={d} className="text-center text-[10px] text-gray-400 font-medium pb-2">{d}</div>
                        ))}
                        {[16, 17, 18, 19, 20].map((d) => (
                          <div key={d} className={cn(
                            "text-center py-2.5 rounded-lg text-xs font-medium transition-all",
                            d === 19 ? "bg-teal-500 text-white shadow-md shadow-teal-500/20" : "text-gray-600 hover:bg-gray-50"
                          )}>{d}</div>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 pt-4 space-y-2">
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-3">Available &mdash; Thu, Feb 19</p>
                        {["9:00 AM", "11:30 AM", "2:00 PM", "4:30 PM"].map((t, i) => (
                          <div key={t} className={cn(
                            "px-3 py-2.5 rounded-lg text-xs font-medium border transition-all flex items-center justify-between",
                            i === 2 ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600"
                          )}>
                            <span>{t}</span>
                            {i === 2 && <Check className="w-3.5 h-3.5 text-teal-600" />}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="px-5 py-3.5 bg-teal-50 border-t border-teal-100 flex items-center gap-2">
                      <Check className="w-4 h-4 text-teal-600" />
                      <span className="text-xs font-semibold text-teal-700">Booked: Thu Feb 19 at 2:00 PM &mdash; SMS confirmation sent</span>
                    </div>
                  </div>
                </motion.div>
                {/* Text */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
                  <div className="inline-flex items-center gap-2 bg-navy-900/5 border border-navy-900/10 rounded-full px-4 py-1.5 mb-5">
                    <Calendar className="w-4 h-4 text-navy-900" />
                    <span className="text-xs font-semibold text-navy-900 uppercase tracking-wider">Scheduling</span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight mb-4">
                    Appointment Scheduling That Just Works
                  </h2>
                  <p className="text-gray-500 mb-8 max-w-lg">
                    Books directly into Google Calendar, Calendly, or your CRM. Handles rescheduling, cancellations, and sends SMS confirmations — all within the same call.
                  </p>
                  <div className="space-y-4">
                    <LightBullet title="Calendar sync" desc="Real-time availability from Google Calendar, Calendly, or your CRM." />
                    <LightBullet title="In-call booking" desc="Finds open slots and confirms while still on the call." />
                    <LightBullet title="Auto confirmations" desc="Sends SMS and email with time, location, and booking link." />
                    <LightBullet title="Reschedule & cancel" desc="Handles changes naturally — no human intervention needed." />
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatedSection>

      {/* FEATURE 4: Call Transfer */}
      <AnimatedSection className="py-20 lg:py-28 bg-navy-950 relative overflow-hidden">
        {(inView) => (
          <>
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: noiseUrl }} />
            <div className="absolute w-[400px] h-[400px] bottom-[-15%] right-[-10%] rounded-full bg-gradient-to-tl from-gold-400/10 to-indigo-500/5 blur-[100px]" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Text */}
                <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
                  <div className="inline-flex items-center gap-2 bg-white/[0.07] border border-white/10 rounded-full px-4 py-1.5 mb-5">
                    <PhoneForwarded className="w-4 h-4 text-gold-400" />
                    <span className="text-xs font-semibold text-gold-400 uppercase tracking-wider">Transfers</span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                    Seamless Call Transfer to Humans
                  </h2>
                  <p className="text-white/50 mb-8 max-w-lg">
                    When situations require a human touch, the AI hands off seamlessly. Your team gets briefed on the caller&apos;s needs before connecting, so nobody repeats themselves.
                  </p>
                  <div className="space-y-4">
                    <DarkBullet title="Warm handoff" desc="AI briefs your team with caller name, issue, and context." />
                    <DarkBullet title="Smart routing" desc="Route to the right department or person based on caller needs." />
                    <DarkBullet title="Availability detection" desc="Checks if a human is available before attempting transfer." />
                    <DarkBullet title="Seamless experience" desc="Caller never notices the transition from AI to human." />
                  </div>
                </motion.div>
                {/* Visual: Transfer Flow */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }}>
                  <div className="space-y-4">
                    {[
                      { step: "01", icon: Phone, title: "AI Handles Call", desc: "Agent answers, identifies the caller, and understands their request.", color: "from-teal-400 to-teal-500" },
                      { step: "02", icon: MessageSquare, title: "Gathers Context", desc: "Collects key details — name, issue, urgency — without the caller repeating.", color: "from-indigo-400 to-indigo-500" },
                      { step: "03", icon: PhoneForwarded, title: "Warm Transfer", desc: "Connects to the right person with a full brief. Your team picks up ready to help.", color: "from-gold-300 to-gold-400" },
                    ].map((s, i) => (
                      <motion.div
                        key={s.step}
                        initial={{ opacity: 0, x: 20 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.3 + i * 0.15, duration: 0.5 }}
                        className="flex items-start gap-4 rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-5"
                      >
                        <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0", s.color)}>
                          <s.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-1">Step {s.step}</p>
                          <p className="text-sm font-semibold text-white mb-1">{s.title}</p>
                          <p className="text-sm text-white/40">{s.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatedSection>

      {/* FEATURE 5: Knowledge Base */}
      <AnimatedSection className="py-20 lg:py-28 bg-white relative overflow-hidden">
        {(inView) => (
          <>
            <div className="absolute w-[500px] h-[500px] top-[10%] right-[-15%] rounded-full bg-gradient-to-bl from-teal-200/15 to-navy-200/10 blur-[120px]" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Text */}
                <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
                  <div className="inline-flex items-center gap-2 bg-navy-900/5 border border-navy-900/10 rounded-full px-4 py-1.5 mb-5">
                    <BookOpen className="w-4 h-4 text-navy-900" />
                    <span className="text-xs font-semibold text-navy-900 uppercase tracking-wider">Knowledge</span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight mb-4">
                    Train Agents on Your Business
                  </h2>
                  <p className="text-gray-500 mb-8 max-w-lg">
                    Upload your documents, FAQs, policies, and procedures. Point to URLs. Your AI agent learns your content and references it accurately on every call.
                  </p>
                  <div className="space-y-4">
                    <LightBullet title="Upload anything" desc="PDFs, Word docs, spreadsheets, or point to web URLs." />
                    <LightBullet title="Auto-learning" desc="Agent indexes your content and references it accurately." />
                    <LightBullet title="Always up to date" desc="Re-syncs automatically when you update your source materials." />
                    <LightBullet title="No hallucination" desc="Cites your actual policies and procedures — never makes things up." />
                  </div>
                </motion.div>
                {/* Visual: Document Stack */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }}>
                  <div className="space-y-3">
                    {[
                      { name: "Company Policies & FAQ.pdf", type: "PDF", size: "2.4 MB", color: "bg-red-50 text-red-600 border-red-100", status: "Indexed" },
                      { name: "Service Procedures Manual.docx", type: "DOCX", size: "1.8 MB", color: "bg-blue-50 text-blue-600 border-blue-100", status: "Indexed" },
                      { name: "https://acme.com/pricing", type: "URL", size: "Auto-sync", color: "bg-purple-50 text-purple-600 border-purple-100", status: "Synced" },
                      { name: "Product Catalog Q1 2026.xlsx", type: "XLSX", size: "890 KB", color: "bg-emerald-50 text-emerald-600 border-emerald-100", status: "Indexed" },
                    ].map((doc, i) => (
                      <motion.div
                        key={doc.name}
                        initial={{ opacity: 0, y: 15 }}
                        animate={inView ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                        className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
                      >
                        <div className={cn("text-[10px] font-bold px-2.5 py-1.5 rounded-lg border", doc.color)}>{doc.type}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-navy-900 truncate">{doc.name}</p>
                          <p className="text-[11px] text-gray-400">{doc.size}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[10px] font-semibold text-emerald-600">{doc.status}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatedSection>

      {/* FEATURE 6: CRM Integration */}
      <AnimatedSection className="py-20 lg:py-28 bg-navy-950 relative overflow-hidden">
        {(inView) => (
          <>
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: noiseUrl }} />
            <div className="absolute w-[400px] h-[400px] top-[-10%] right-[-5%] rounded-full bg-gradient-to-bl from-teal-500/10 to-navy-400/5 blur-[100px]" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Visual: CRM Connections */}
                <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }} className="order-2 lg:order-1">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6">
                    <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest mb-5">Connected Platforms</p>
                    <div className="space-y-3">
                      {[
                        { name: "HubSpot", desc: "Contacts, deals, and tickets synced", color: "from-orange-400 to-orange-500" },
                        { name: "Salesforce", desc: "Leads, opportunities, and activities logged", color: "from-blue-400 to-blue-500", soon: true },
                        { name: "GoHighLevel", desc: "Contacts, pipelines, and automations", color: "from-emerald-400 to-emerald-500", soon: true },
                        { name: "Custom Webhook", desc: "Send data to any endpoint via REST API", color: "from-purple-400 to-purple-500" },
                      ].map((crm, i) => (
                        <motion.div
                          key={crm.name}
                          initial={{ opacity: 0, x: -15 }}
                          animate={inView ? { opacity: 1, x: 0 } : {}}
                          transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                          className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 hover:bg-white/[0.06] transition-colors"
                        >
                          <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0", crm.color)}>
                            <Link2 className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{crm.name}</p>
                            <p className="text-[11px] text-white/40">{crm.desc}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {crm.soon ? (
                              <span className="text-[10px] font-semibold text-amber-400">Coming Soon</span>
                            ) : (
                              <>
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span className="text-[10px] font-semibold text-emerald-400">Live</span>
                              </>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
                {/* Text */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }} className="order-1 lg:order-2">
                  <div className="inline-flex items-center gap-2 bg-white/[0.07] border border-white/10 rounded-full px-4 py-1.5 mb-5">
                    <Link2 className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Integrations</span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                    CRM Integration, Fully Automatic
                  </h2>
                  <p className="text-white/50 mb-8 max-w-lg">
                    Every call logged, every lead captured, every record updated automatically. Native integrations with the platforms you already use — plus custom webhooks for everything else.
                  </p>
                  <div className="space-y-4">
                    <DarkBullet title="Auto-log every call" desc="Transcripts, outcomes, and recordings saved to your CRM." />
                    <DarkBullet title="Create & update contacts" desc="New leads captured, existing records enriched automatically." />
                    <DarkBullet title="Pipeline management" desc="Move deals through stages based on call outcomes." />
                    <DarkBullet title="Custom webhooks" desc="Connect to any tool or workflow via REST API." />
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatedSection>

      {/* FEATURE 7: SMS Follow-Up */}
      <AnimatedSection className="py-20 lg:py-28 bg-white relative overflow-hidden">
        {(inView) => (
          <>
            <div className="absolute w-[400px] h-[400px] top-[-10%] left-[-10%] rounded-full bg-gradient-to-br from-teal-200/20 to-navy-200/10 blur-[120px]" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Visual: SMS Chat Mockup */}
                <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }}>
                  <div className="mx-auto max-w-xs">
                    <div className="rounded-[28px] border-2 border-gray-200 bg-gray-50 p-3 shadow-xl shadow-gray-200/50">
                      <div className="rounded-[20px] bg-white overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 text-center">
                          <p className="text-[10px] text-gray-400 font-medium">Messages</p>
                          <p className="text-xs font-semibold text-navy-900">Acme Dental</p>
                        </div>
                        <div className="px-4 py-5 space-y-3 min-h-[240px]">
                          {[
                            { from: "ai", text: "Hi Sarah! Your appointment with Dr. Martinez is confirmed for Thu, Feb 19 at 2:00 PM. \ud83d\udcc5" },
                            { from: "ai", text: "Here\u2019s your booking link: acme.co/appt/8291\nLocation: 123 Main St, Suite 200" },
                            { from: "user", text: "Thanks! Do I need to bring anything?" },
                            { from: "ai", text: "Just your insurance card and ID. We\u2019ll handle the rest. See you Thursday! \ud83d\ude0a" },
                          ].map((msg, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, y: 10 }}
                              animate={inView ? { opacity: 1, y: 0 } : {}}
                              transition={{ delay: 0.4 + i * 0.15, duration: 0.3 }}
                              className={cn("flex", msg.from === "user" ? "justify-end" : "justify-start")}
                            >
                              <div className={cn(
                                "rounded-2xl px-3.5 py-2 max-w-[80%] text-[12px] leading-relaxed",
                                msg.from === "user" ? "bg-blue-500 text-white rounded-br-sm" : "bg-gray-100 text-gray-700 rounded-bl-sm"
                              )}>
                                {msg.text}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
                {/* Text */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
                  <div className="inline-flex items-center gap-2 bg-navy-900/5 border border-navy-900/10 rounded-full px-4 py-1.5 mb-5">
                    <MessageCircle className="w-4 h-4 text-navy-900" />
                    <span className="text-xs font-semibold text-navy-900 uppercase tracking-wider">SMS</span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight mb-4">
                    Automated SMS Follow-Up
                  </h2>
                  <p className="text-gray-500 mb-8 max-w-lg">
                    Send confirmation texts, booking links, directions, and follow-up messages after every call. Keep the conversation going without lifting a finger.
                  </p>
                  <div className="space-y-4">
                    <LightBullet title="Booking confirmations" desc="Time, date, and calendar link sent automatically after scheduling." />
                    <LightBullet title="Directions & links" desc="Share location, forms, or payment links via text message." />
                    <LightBullet title="Follow-up sequences" desc="Multi-message drip campaigns triggered by call outcomes." />
                    <LightBullet title="Two-way messaging" desc="Callers can text back and the AI continues the conversation." />
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatedSection>

      {/* FEATURE 8: Post-Call Analytics */}
      <AnimatedSection className="py-20 lg:py-28 bg-navy-950 relative overflow-hidden">
        {(inView) => (
          <>
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: noiseUrl }} />
            <div className="absolute w-[500px] h-[500px] top-[-10%] left-[-10%] rounded-full bg-gradient-to-br from-indigo-500/10 to-teal-500/5 blur-[100px]" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Text */}
                <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
                  <div className="inline-flex items-center gap-2 bg-white/[0.07] border border-white/10 rounded-full px-4 py-1.5 mb-5">
                    <BarChart3 className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Analytics</span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                    Post-Call Analytics & Insights
                  </h2>
                  <p className="text-white/50 mb-8 max-w-lg">
                    Full transcripts, sentiment analysis, call outcomes, topic detection, and performance dashboards. Know exactly how every call went and where to optimize.
                  </p>
                  <div className="space-y-4">
                    <DarkBullet title="Full transcripts" desc="Every word searchable and reviewable with timestamps." />
                    <DarkBullet title="Sentiment analysis" desc="Detect satisfaction, frustration, or urgency per call." />
                    <DarkBullet title="Call outcomes" desc="Track bookings, transfers, objections, and resolutions." />
                    <DarkBullet title="Performance dashboards" desc="Monitor trends, agent performance, and ROI over time." />
                  </div>
                </motion.div>
                {/* Visual: Analytics Dashboard */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }}>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/50">Performance Dashboard</span>
                      <span className="text-[10px] font-medium text-white/30">Last 30 days</span>
                    </div>
                    <div className="grid grid-cols-3 gap-px bg-white/5">
                      {[
                        { value: "2,847", label: "Total Calls", change: "+12%", up: true },
                        { value: "3:24", label: "Avg Duration", change: "-8%", up: true },
                        { value: "94%", label: "Satisfaction", change: "+3%", up: true },
                      ].map((m) => (
                        <div key={m.label} className="bg-navy-950 px-4 py-4">
                          <p className="text-xl font-bold text-white">{m.value}</p>
                          <p className="text-[10px] text-white/30 uppercase tracking-wide mt-0.5">{m.label}</p>
                          <span className={cn("text-[10px] font-semibold", m.up ? "text-emerald-400" : "text-red-400")}>{m.change}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-5">
                      <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest mb-4">Call Volume &mdash; This Week</p>
                      <div className="flex items-end gap-2 h-28">
                        {[40, 65, 55, 80, 70, 90, 45].map((h, i) => (
                          <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            animate={inView ? { height: `${h}%` } : {}}
                            transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
                            className="flex-1 rounded-t-md bg-gradient-to-t from-teal-500/60 to-teal-400/30"
                          />
                        ))}
                      </div>
                      <div className="flex justify-between mt-2">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                          <span key={d} className="text-[9px] text-white/20 flex-1 text-center">{d}</span>
                        ))}
                      </div>
                    </div>
                    <div className="px-5 pb-5 grid grid-cols-2 gap-3">
                      {[
                        { label: "Appointments Booked", value: "847", icon: Calendar },
                        { label: "Leads Captured", value: "1,203", icon: Users },
                      ].map((s) => (
                        <div key={s.label} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 flex items-center gap-3">
                          <s.icon className="w-4 h-4 text-teal-400 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-white">{s.value}</p>
                            <p className="text-[10px] text-white/30">{s.label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatedSection>

      {/* FEATURE 9: Multi-Language */}
      <AnimatedSection className="py-20 lg:py-28 bg-white relative overflow-hidden">
        {(inView) => (
          <>
            <div className="absolute w-[400px] h-[400px] bottom-[-10%] right-[-10%] rounded-full bg-gradient-to-tl from-navy-200/20 to-teal-100/10 blur-[120px]" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="text-center mb-14">
                <div className="inline-flex items-center gap-2 bg-navy-900/5 border border-navy-900/10 rounded-full px-4 py-1.5 mb-5">
                  <Globe className="w-4 h-4 text-navy-900" />
                  <span className="text-xs font-semibold text-navy-900 uppercase tracking-wider">Languages</span>
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight mb-4">
                  30+ Languages, One Agent
                </h2>
                <p className="text-gray-500 max-w-2xl mx-auto">
                  Handle calls in Spanish, French, Mandarin, Portuguese, and 30+ more languages. Auto-detection switches seamlessly — no separate agents, no extra cost.
                </p>
              </motion.div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                {[
                  { lang: "Spanish", native: "Espa\u00f1ol", flag: "\ud83c\uddea\ud83c\uddf8" },
                  { lang: "French", native: "Fran\u00e7ais", flag: "\ud83c\uddeb\ud83c\uddf7" },
                  { lang: "Mandarin", native: "\u4e2d\u6587", flag: "\ud83c\udde8\ud83c\uddf3" },
                  { lang: "Portuguese", native: "Portugu\u00eas", flag: "\ud83c\udde7\ud83c\uddf7" },
                  { lang: "German", native: "Deutsch", flag: "\ud83c\udde9\ud83c\uddea" },
                  { lang: "Japanese", native: "\u65e5\u672c\u8a9e", flag: "\ud83c\uddef\ud83c\uddf5" },
                  { lang: "Arabic", native: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", flag: "\ud83c\uddf8\ud83c\udde6" },
                  { lang: "Korean", native: "\ud55c\uad6d\uc5b4", flag: "\ud83c\uddf0\ud83c\uddf7" },
                ].map((l, i) => (
                  <motion.div
                    key={l.lang}
                    initial={{ opacity: 0, y: 15 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.2 + i * 0.06, duration: 0.4 }}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-md transition-all"
                  >
                    <span className="text-2xl">{l.flag}</span>
                    <div>
                      <p className="text-sm font-semibold text-navy-900">{l.lang}</p>
                      <p className="text-[11px] text-gray-400">{l.native}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <motion.div initial={{ opacity: 0, y: 15 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.7, duration: 0.5 }} className="text-center">
                <div className="inline-flex items-center gap-3 bg-navy-900/5 rounded-full px-6 py-3">
                  <span className="text-sm font-medium text-navy-900">+ 22 more languages available</span>
                  <Zap className="w-4 h-4 text-gold-400" />
                  <span className="text-xs text-gray-500">Auto-detection included</span>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatedSection>

      {/* FEATURE 10: Custom Workflows */}
      <AnimatedSection className="py-20 lg:py-28 bg-navy-950 relative overflow-hidden">
        {(inView) => (
          <>
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: noiseUrl }} />
            <div className="absolute w-[400px] h-[400px] bottom-[-15%] left-[-10%] rounded-full bg-gradient-to-tr from-indigo-500/10 to-teal-500/5 blur-[100px]" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Visual: Workflow Builder */}
                <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }} className="order-2 lg:order-1">
                  <div className="space-y-3">
                    {/* Trigger */}
                    <motion.div initial={{ opacity: 0, y: 15 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.3, duration: 0.4 }}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Trigger</p>
                        <p className="text-sm font-medium text-white">Incoming Call Received</p>
                      </div>
                    </motion.div>
                    {/* Arrow */}
                    <div className="flex justify-center"><div className="w-px h-6 bg-white/10" /></div>
                    {/* Condition */}
                    <motion.div initial={{ opacity: 0, y: 15 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.45, duration: 0.4 }}
                      className="rounded-xl border border-gold-400/20 bg-gold-400/5 backdrop-blur-sm p-4 flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold-300 to-gold-400 flex items-center justify-center">
                        <GitBranch className="w-4 h-4 text-navy-900" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gold-400/50 uppercase tracking-widest">Condition</p>
                        <p className="text-sm font-medium text-white">Is caller an existing patient?</p>
                      </div>
                    </motion.div>
                    {/* Branches */}
                    <div className="grid grid-cols-2 gap-3">
                      <motion.div initial={{ opacity: 0, y: 15 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.6, duration: 0.4 }}>
                        <div className="flex justify-center mb-2"><div className="w-px h-4 bg-white/10" /></div>
                        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                          <p className="text-[10px] font-bold text-emerald-400/50 uppercase tracking-widest mb-1">Yes</p>
                          <p className="text-xs text-white/60">Pull records, offer scheduling, update CRM</p>
                        </div>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, y: 15 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.7, duration: 0.4 }}>
                        <div className="flex justify-center mb-2"><div className="w-px h-4 bg-white/10" /></div>
                        <div className="rounded-xl border border-indigo-400/20 bg-indigo-400/5 p-4">
                          <p className="text-[10px] font-bold text-indigo-400/50 uppercase tracking-widest mb-1">No</p>
                          <p className="text-xs text-white/60">Qualify lead, collect info, book consultation</p>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
                {/* Text */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }} className="order-1 lg:order-2">
                  <div className="inline-flex items-center gap-2 bg-white/[0.07] border border-white/10 rounded-full px-4 py-1.5 mb-5">
                    <GitBranch className="w-4 h-4 text-gold-400" />
                    <span className="text-xs font-semibold text-gold-400 uppercase tracking-wider">Workflows</span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                    Custom Workflows & Logic
                  </h2>
                  <p className="text-white/50 mb-8 max-w-lg">
                    Build conditional logic, qualification flows, and routing rules tailored to your business. If-this-then-that logic that adapts to every caller&apos;s unique needs.
                  </p>
                  <div className="space-y-4">
                    <DarkBullet title="Conditional logic" desc="If/then rules based on caller input, time of day, or CRM data." />
                    <DarkBullet title="Lead qualification" desc="Score and route callers based on their answers." />
                    <DarkBullet title="Dynamic routing" desc="Send calls to different flows based on department or intent." />
                    <DarkBullet title="API triggers" desc="Fire webhooks, update records, or start automations mid-call." />
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatedSection>

      {/* FEATURE 11: Conversation Flows */}
      <AnimatedSection className="py-20 lg:py-28 bg-white relative overflow-hidden">
        {(inView) => (
          <>
            <div className="absolute w-[500px] h-[500px] top-[-10%] left-[-15%] rounded-full bg-gradient-to-br from-indigo-200/20 to-navy-200/10 blur-[120px]" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Text */}
                <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
                  <div className="inline-flex items-center gap-2 bg-navy-900/5 border border-navy-900/10 rounded-full px-4 py-1.5 mb-5">
                    <Workflow className="w-4 h-4 text-navy-900" />
                    <span className="text-xs font-semibold text-navy-900 uppercase tracking-wider">Conversation Flows</span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight mb-4">
                    Visual Flow Builder for Guided Interactions
                  </h2>
                  <p className="text-gray-500 mb-8 max-w-lg">
                    Design complex agent conversation paths with a drag-and-drop flow builder. Create branching logic, conditional responses, and multi-step interactions without writing a single line of code.
                  </p>
                  <div className="space-y-4">
                    <LightBullet title="Drag-and-drop builder" desc="Visually design conversation paths with an intuitive canvas interface." />
                    <LightBullet title="Branching logic" desc="Create if/then branches based on caller responses, intent, or data lookups." />
                    <LightBullet title="Reusable templates" desc="Start from industry-specific templates and customize to your business." />
                    <LightBullet title="Version control" desc="Test new flows safely with version history and rollback support." />
                  </div>
                </motion.div>
                {/* Visual: Flow Builder */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }}>
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Flow Builder</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-gray-400">v2.1</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-[10px] font-semibold text-emerald-600">Published</span>
                      </div>
                    </div>
                    <div className="p-5 space-y-3">
                      {[
                        { step: "Start", desc: "Greet caller, identify intent", color: "bg-teal-50 border-teal-200 text-teal-700", icon: "🟢" },
                        { step: "Qualify", desc: "Ask qualifying questions", color: "bg-blue-50 border-blue-200 text-blue-700", icon: "❓" },
                        { step: "Route", desc: "Branch: Schedule / Transfer / FAQ", color: "bg-amber-50 border-amber-200 text-amber-700", icon: "🔀" },
                        { step: "Action", desc: "Book appointment or log lead", color: "bg-indigo-50 border-indigo-200 text-indigo-700", icon: "⚡" },
                        { step: "Wrap Up", desc: "Confirm, send SMS, update CRM", color: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: "✅" },
                      ].map((node, i) => (
                        <motion.div
                          key={node.step}
                          initial={{ opacity: 0, x: 15 }}
                          animate={inView ? { opacity: 1, x: 0 } : {}}
                          transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                        >
                          {i > 0 && <div className="flex justify-center mb-3"><div className="w-px h-4 bg-gray-200" /></div>}
                          <div className={cn("flex items-center gap-3 rounded-xl border p-3.5", node.color)}>
                            <span className="text-lg">{node.icon}</span>
                            <div>
                              <p className="text-xs font-semibold">{node.step}</p>
                              <p className="text-[11px] opacity-70">{node.desc}</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatedSection>

      {/* FEATURE 12: Usage Dashboard */}
      <AnimatedSection className="py-20 lg:py-28 bg-navy-950 relative overflow-hidden">
        {(inView) => (
          <>
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: noiseUrl }} />
            <div className="absolute w-[400px] h-[400px] bottom-[-15%] right-[-10%] rounded-full bg-gradient-to-tl from-teal-500/10 to-indigo-500/5 blur-[100px]" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Visual: Usage Dashboard */}
                <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }} className="order-2 lg:order-1">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/50">Usage Dashboard</span>
                      <span className="text-[10px] font-medium text-white/30">Current Billing Period</span>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-white/5">
                      {[
                        { value: "4,231", label: "Total Minutes", pct: "68%" },
                        { value: "$847", label: "Current Spend", pct: "71%" },
                        { value: "1,892", label: "Calls Made", pct: "54%" },
                        { value: "12", label: "Active Agents", pct: "40%" },
                      ].map((m) => (
                        <div key={m.label} className="bg-navy-950 px-4 py-4">
                          <p className="text-lg font-bold text-white">{m.value}</p>
                          <p className="text-[10px] text-white/30 uppercase tracking-wide mt-0.5">{m.label}</p>
                          <div className="mt-2 h-1 rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400" style={{ width: m.pct }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-5">
                      <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest mb-4">Daily Usage Trend</p>
                      <div className="flex items-end gap-1.5 h-20">
                        {[35, 50, 45, 65, 55, 75, 60, 80, 70, 85, 65, 55, 70, 90].map((h, i) => (
                          <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            animate={inView ? { height: `${h}%` } : {}}
                            transition={{ delay: 0.4 + i * 0.05, duration: 0.5 }}
                            className="flex-1 rounded-t-sm bg-gradient-to-t from-teal-500/50 to-teal-400/20"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
                {/* Text */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }} className="order-1 lg:order-2">
                  <div className="inline-flex items-center gap-2 bg-white/[0.07] border border-white/10 rounded-full px-4 py-1.5 mb-5">
                    <Activity className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Usage</span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                    Real-Time Usage Dashboard
                  </h2>
                  <p className="text-white/50 mb-8 max-w-lg">
                    Track every minute, every call, and every dollar in real time. Set usage alerts, forecast costs, and optimize agent performance with detailed billing metrics.
                  </p>
                  <div className="space-y-4">
                    <DarkBullet title="Real-time tracking" desc="Live minute counts, call volumes, and spend updated as calls happen." />
                    <DarkBullet title="Usage alerts" desc="Get notified when you approach plan limits or unusual spikes occur." />
                    <DarkBullet title="Cost forecasting" desc="Predict monthly costs based on current usage patterns." />
                    <DarkBullet title="Per-agent breakdown" desc="See which agents consume the most minutes and drive the most value." />
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatedSection>

      {/* FEATURE 13: Compliance & Security */}
      <AnimatedSection className="py-20 lg:py-28 bg-white relative overflow-hidden">
        {(inView) => (
          <>
            <div className="absolute w-[400px] h-[400px] top-[-10%] left-[-15%] rounded-full bg-gradient-to-br from-navy-200/15 to-teal-100/10 blur-[120px]" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Text */}
                <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}>
                  <div className="inline-flex items-center gap-2 bg-navy-900/5 border border-navy-900/10 rounded-full px-4 py-1.5 mb-5">
                    <ShieldCheck className="w-4 h-4 text-navy-900" />
                    <span className="text-xs font-semibold text-navy-900 uppercase tracking-wider">Security</span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight mb-4">
                    Enterprise-Grade Compliance & Security
                  </h2>
                  <p className="text-gray-500 mb-8 max-w-lg">
                    HIPAA-ready infrastructure, configurable call recording controls, and PII redaction. Built for regulated industries from day one.
                  </p>
                  <div className="space-y-4">
                    <LightBullet title="HIPAA-ready" desc="Infrastructure meets healthcare data handling requirements." />
                    <LightBullet title="Call recording controls" desc="Configurable recording with pause and resume for sensitive info." />
                    <LightBullet title="PII redaction" desc="Configurable rules to mask sensitive data in transcripts and logs." />
                  </div>
                </motion.div>
                {/* Visual: Compliance Badges */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }}>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { title: "HIPAA", desc: "Healthcare data handling compliant", icon: ShieldCheck, color: "bg-emerald-50 border-emerald-200 text-emerald-600" },
                      { title: "Encryption", desc: "AES-256 at rest, TLS 1.3 in transit", icon: Lock, color: "bg-purple-50 border-purple-200 text-purple-600" },
                      { title: "PII Redaction", desc: "Configurable rules for sensitive data", icon: ShieldCheck, color: "bg-amber-50 border-amber-200 text-amber-600" },
                      { title: "RBAC", desc: "Role-based access with module-level permissions", icon: Lock, color: "bg-blue-50 border-blue-200 text-blue-600" },
                    ].map((badge, i) => (
                      <motion.div
                        key={badge.title}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={inView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                        className={cn("rounded-xl border-2 p-5 text-center", badge.color)}
                      >
                        <badge.icon className="w-8 h-8 mx-auto mb-3" />
                        <p className="text-base font-bold mb-1">{badge.title}</p>
                        <p className="text-xs opacity-70">{badge.desc}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatedSection>

      {/* FEATURE 12: Branded Caller ID */}
      <AnimatedSection className="py-20 lg:py-28 bg-navy-950 relative overflow-hidden">
        {(inView) => (
          <>
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: noiseUrl }} />
            <div className="absolute w-[400px] h-[400px] top-[-10%] right-[-5%] rounded-full bg-gradient-to-bl from-teal-500/10 to-indigo-500/5 blur-[100px]" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Visual: Phone Comparison */}
                <motion.div initial={{ opacity: 0, x: -30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, delay: 0.15 }} className="order-2 lg:order-1">
                  <div className="flex items-center justify-center gap-6 sm:gap-10">
                    {/* Without */}
                    <div>
                      <div className="text-center mb-3">
                        <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">Without</span>
                      </div>
                      <div className="w-[150px] sm:w-[170px] rounded-[24px] border border-white/10 bg-white/[0.04] p-2.5">
                        <div className="rounded-[18px] bg-navy-900/50 overflow-hidden">
                          <div className="px-4 py-8 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                              <Phone className="w-5 h-5 text-red-400" />
                            </div>
                            <div className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-0.5 mb-3">
                              <X className="w-3 h-3 text-red-400" />
                              <span className="text-[10px] font-semibold text-red-400">Spam Likely</span>
                            </div>
                            <p className="text-xs font-semibold text-white/80">(555) 123-4567</p>
                            <p className="text-[10px] text-white/30 mt-0.5">Unknown Caller</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* With */}
                    <div>
                      <div className="text-center mb-3">
                        <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">With Branded ID</span>
                      </div>
                      <div className="w-[150px] sm:w-[170px] rounded-[24px] border border-teal-500/30 bg-teal-500/5 p-2.5 shadow-lg shadow-teal-500/10">
                        <div className="rounded-[18px] bg-navy-900/50 overflow-hidden">
                          <div className="px-4 py-8 text-center">
                            <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-3 ring-2 ring-teal-500/30">
                              <span className="text-sm font-bold text-teal-400">AB</span>
                            </div>
                            <div className="inline-flex items-center gap-1 bg-teal-500/10 border border-teal-500/20 rounded-full px-2.5 py-0.5 mb-3">
                              <ShieldCheck className="w-3 h-3 text-teal-400" />
                              <span className="text-[10px] font-semibold text-teal-400">Verified</span>
                            </div>
                            <p className="text-xs font-semibold text-white/80">Acme Business</p>
                            <p className="text-[10px] text-teal-400/70 mt-0.5">Appointment Reminder</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
                {/* Text */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }} className="order-1 lg:order-2">
                  <div className="inline-flex items-center gap-2 bg-white/[0.07] border border-white/10 rounded-full px-4 py-1.5 mb-5">
                    <UserCheck className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Caller ID</span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                    Branded Caller ID That Builds Trust
                  </h2>
                  <p className="text-white/50 mb-8 max-w-lg">
                    Display your business name, logo, and call reason on every outbound call. Build trust before the conversation even starts and increase answer rates by up to 3x.
                  </p>
                  <div className="space-y-4">
                    <DarkBullet title="Business name display" desc="Your company name shows instead of an unknown number." />
                    <DarkBullet title="Verified badge" desc="Carriers display 'Verified Business' to build instant trust." />
                    <DarkBullet title="Up to 3x answer rates" desc="Branded calls dramatically outperform unknown numbers." />
                    <DarkBullet title="Spam protection" desc="STIR/SHAKEN authentication reduces spam flagging." />
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatedSection>

      {/* Before / After */}
      <section ref={beforeAfterRef} className="py-24 lg:py-32 bg-white relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] top-[-10%] right-[-15%] rounded-full bg-gradient-to-br from-teal-200/15 to-navy-200/10 blur-[120px]" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={beforeAfterInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Impact</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight">
              Before Invaria vs. After Invaria
            </h2>
          </motion.div>
          <div className="space-y-3">
            {beforeAfter.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={beforeAfterInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="grid grid-cols-2 gap-3"
              >
                <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50/50 p-4 transition-colors hover:bg-red-50">
                  <X className="w-5 h-5 text-red-400 shrink-0" />
                  <span className="text-sm text-gray-600">{item.before}</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 transition-colors hover:bg-emerald-50">
                  <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="text-sm text-gray-600">{item.after}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        heading="See These Features In Action"
        subheading="Book a 15-minute demo and watch your industry template handle real calls."
        primaryCta={{ label: "Book a Demo", href: "/contact" }}
        secondaryCta={{ label: "View Pricing", href: "/pricing" }}
        variant="dark"
      />
    </main>
  );
}
