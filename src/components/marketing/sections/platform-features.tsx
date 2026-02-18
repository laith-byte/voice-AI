"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Phone, MessageSquare, Mail, Code, Shield, EyeOff, Users,
  Server, Headphones, BadgeCheck, PhoneCall, Megaphone, ShieldCheck,
  Check, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

/* --- Omnichannel --- */
const channels = [
  { icon: Phone, title: "Voice Call", description: "Natural, human-like phone conversations powered by the latest LLMs. Inbound and outbound at scale.", gradient: "from-teal-400 to-teal-500", stat: "100+", statLabel: "concurrent calls" },
  { icon: MessageSquare, title: "Chat", description: "AI-powered conversations across web and in-app chat with full context awareness.", gradient: "from-indigo-400 to-indigo-500", stat: "24/7", statLabel: "availability" },
  { icon: Mail, title: "SMS", description: "Automated text workflows — confirmations, follow-ups, and post-call messaging.", gradient: "from-gold-300 to-gold-400", stat: "Auto", statLabel: "follow-ups" },
  { icon: Code, title: "API", description: "Programmatic access to agents, calls, and analytics via REST API.", gradient: "from-purple-400 to-purple-500", stat: "Full", statLabel: "access" },
];

export function Omnichannel() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-24 lg:py-32 bg-gray-50 relative overflow-hidden">
      <div className="absolute w-[500px] h-[500px] bottom-[-10%] left-[-15%] rounded-full bg-gradient-to-br from-teal-200/15 to-navy-200/5 blur-[120px]" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-sm font-semibold text-navy-900/40 uppercase tracking-widest mb-3">Channels</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight">
            True Omni-Channel Communication
          </h2>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {channels.map((ch, i) => {
            const Icon = ch.icon;
            return (
              <motion.div
                key={ch.title}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="group rounded-xl border border-gray-200 bg-white p-6 transition-all duration-300 hover:border-gray-300 hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-1"
              >
                <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 shadow-lg", ch.gradient)}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-navy-900 mb-1.5">{ch.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">{ch.description}</p>
                <div className="pt-3 border-t border-gray-100">
                  <span className="text-lg font-bold text-navy-900">{ch.stat}</span>
                  <span className="text-[10px] text-gray-400 ml-1.5 uppercase tracking-wide">{ch.statLabel}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --- Telephony Stack --- */
const telephonyFeatures = [
  { icon: BadgeCheck, title: "Branded Caller ID", description: "Display your business name, logo, and call reason on outbound calls. Boost answer rates by up to 3x.", gradient: "from-teal-400 to-teal-500", bullets: ["Business name display", "Verified badge", "Up to 3x answer rates"] },
  { icon: PhoneCall, title: "SIP Trunking", description: "Connect your existing phone numbers or VoIP providers via SIP trunking — no infrastructure changes.", gradient: "from-indigo-400 to-indigo-500", bullets: ["Bring your own numbers", "Any VoIP provider", "Zero migration downtime"] },
  { icon: Megaphone, title: "Batch Calling", description: "Run outbound call campaigns at scale with detailed conversion tracking and real-time monitoring.", gradient: "from-gold-300 to-gold-400", bullets: ["Campaign management", "Conversion tracking", "Real-time monitoring"] },
  { icon: ShieldCheck, title: "Verified Numbers", description: "Prevent your calls from being labeled as spam with carrier-verified phone number registration.", gradient: "from-emerald-400 to-emerald-500", bullets: ["STIR/SHAKEN auth", "Spam flag prevention", "Carrier verification"] },
];

export function TelephonyStack() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-24 lg:py-32 bg-navy-950 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }} />
      <div className="absolute w-[400px] h-[400px] top-[-10%] right-[-5%] rounded-full bg-gradient-to-bl from-teal-500/10 to-indigo-500/5 blur-[100px]" />
      <div className="absolute w-[300px] h-[300px] bottom-[-10%] left-[-5%] rounded-full bg-gradient-to-tr from-gold-400/10 to-navy-400/5 blur-[100px]" />
      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-3">Telephony</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
            A Telephony Stack Built for Results
          </h2>
        </motion.div>
        <div className="grid sm:grid-cols-2 gap-5">
          {telephonyFeatures.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="group rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-6 transition-all duration-300 hover:bg-white/[0.07] hover:-translate-y-1"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={cn("w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-lg transition-transform duration-300 group-hover:scale-110", feat.gradient)}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1.5">{feat.title}</h3>
                    <p className="text-xs text-white/40 leading-relaxed">{feat.description}</p>
                  </div>
                </div>
                <div className="space-y-2 ml-15">
                  {feat.bullets.map((b) => (
                    <div key={b} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-teal-400/10 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-teal-400" />
                      </div>
                      <span className="text-xs text-white/50">{b}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --- Enterprise Security --- */
const securityFeatures = [
  { icon: Shield, title: "HIPAA Compliant", description: "Infrastructure built for healthcare and regulated industries from day one.", color: "bg-emerald-50 border-emerald-200 text-emerald-600" },
  { icon: EyeOff, title: "PII Redaction", description: "Configurable controls to redact sensitive data in calls and transcripts.", color: "bg-purple-50 border-purple-200 text-purple-600" },
  { icon: Users, title: "Role-Based Access", description: "Configurable roles with module-level permissions.", color: "bg-amber-50 border-amber-200 text-amber-600" },
  { icon: Server, title: "Scale to Millions", description: "Infrastructure capacity built for millions of calls and high availability.", color: "bg-teal-50 border-teal-200 text-teal-600" },
  { icon: Headphones, title: "White-Glove Onboarding", description: "Dedicated implementation team for smooth enterprise deployment.", color: "bg-indigo-50 border-indigo-200 text-indigo-600" },
];

export function EnterpriseSecurity() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-24 lg:py-32 bg-white relative overflow-hidden">
      <div className="absolute w-[400px] h-[400px] top-[-10%] left-[-10%] rounded-full bg-gradient-to-br from-navy-200/15 to-teal-100/10 blur-[120px]" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight mb-4">
            Enterprise-Grade Security and Reliability
          </h2>
          <p className="text-base text-gray-500 max-w-2xl mx-auto">
            From data protection and compliance to uptime and resilience — the security required to run voice AI at production scale.
          </p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-5">
          {securityFeatures.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className={cn("group rounded-xl border-2 p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 lg:col-span-2", i === 3 && "lg:col-start-2", feat.color)}
              >
                <Icon className="w-8 h-8 mb-4 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="text-sm font-bold text-navy-900 mb-1.5">{feat.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{feat.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --- Integrations --- */
const integrations = [
  {
    name: "HubSpot",
    abbr: "HS",
    category: "CRM",
    description: "Sync contacts, deals, and call logs bi-directionally",
    bg: "bg-[#FF7A59]/10",
    text: "text-[#FF7A59]",
    border: "border-[#FF7A59]/20",
    ring: "group-hover:ring-[#FF7A59]/20",
  },
  {
    name: "Salesforce",
    abbr: "SF",
    category: "CRM",
    comingSoon: true,
    description: "Push call outcomes and transcripts to any Salesforce object",
    bg: "bg-[#00A1E0]/10",
    text: "text-[#00A1E0]",
    border: "border-[#00A1E0]/20",
    ring: "group-hover:ring-[#00A1E0]/20",
  },
  {
    name: "GoHighLevel",
    abbr: "GL",
    category: "CRM",
    comingSoon: true,
    description: "Trigger workflows and update pipelines on every call",
    bg: "bg-[#4CAF50]/10",
    text: "text-[#4CAF50]",
    border: "border-[#4CAF50]/20",
    ring: "group-hover:ring-[#4CAF50]/20",
  },
  {
    name: "Twilio",
    abbr: "TW",
    category: "Communication",
    description: "Bring your own Twilio numbers and SIP trunks",
    bg: "bg-[#F22F46]/10",
    text: "text-[#F22F46]",
    border: "border-[#F22F46]/20",
    ring: "group-hover:ring-[#F22F46]/20",
  },
  {
    name: "Slack",
    abbr: "SL",
    category: "Communication",
    description: "Get instant call alerts and summaries in any channel",
    bg: "bg-[#611f69]/10",
    text: "text-[#611f69]",
    border: "border-[#611f69]/20",
    ring: "group-hover:ring-[#611f69]/20",
  },
  {
    name: "Google Calendar",
    abbr: "GC",
    category: "Scheduling",
    description: "Book, reschedule, and check availability in real time",
    bg: "bg-[#4285F4]/10",
    text: "text-[#4285F4]",
    border: "border-[#4285F4]/20",
    ring: "group-hover:ring-[#4285F4]/20",
  },
  {
    name: "Calendly",
    abbr: "CA",
    category: "Scheduling",
    description: "Create scheduling links and confirm bookings live on calls",
    bg: "bg-[#006BFF]/10",
    text: "text-[#006BFF]",
    border: "border-[#006BFF]/20",
    ring: "group-hover:ring-[#006BFF]/20",
  },
  {
    name: "Zapier",
    abbr: "ZP",
    category: "Automation",
    description: "Connect to 7,000+ apps and CRMs with no-code automations",
    bg: "bg-[#FF4F00]/10",
    text: "text-[#FF4F00]",
    border: "border-[#FF4F00]/20",
    ring: "group-hover:ring-[#FF4F00]/20",
  },
  {
    name: "Make",
    abbr: "MK",
    category: "Automation",
    description: "Build advanced multi-step automations visually",
    bg: "bg-[#6D00CC]/10",
    text: "text-[#6D00CC]",
    border: "border-[#6D00CC]/20",
    ring: "group-hover:ring-[#6D00CC]/20",
  },
  {
    name: "n8n",
    abbr: "N8",
    category: "Automation",
    description: "Self-hosted workflow automation with full control",
    bg: "bg-[#EA4B71]/10",
    text: "text-[#EA4B71]",
    border: "border-[#EA4B71]/20",
    ring: "group-hover:ring-[#EA4B71]/20",
  },
  {
    name: "Webhooks",
    abbr: "WH",
    category: "Developer",
    description: "Send real-time call events to any endpoint you configure",
    bg: "bg-navy-500/10",
    text: "text-navy-600",
    border: "border-navy-500/20",
    ring: "group-hover:ring-navy-500/20",
  },
  {
    name: "REST API",
    abbr: "AP",
    category: "Developer",
    description: "Full programmatic access to agents, calls, and analytics",
    bg: "bg-teal-500/10",
    text: "text-teal-600",
    border: "border-teal-500/20",
    ring: "group-hover:ring-teal-500/20",
  },
];

const categories = ["CRM", "Communication", "Scheduling", "Automation", "Developer"];
const categoryStyles: Record<string, string> = {
  CRM: "bg-blue-50 text-blue-600 border-blue-200",
  Communication: "bg-teal-50 text-teal-600 border-teal-200",
  Scheduling: "bg-purple-50 text-purple-600 border-purple-200",
  Automation: "bg-amber-50 text-amber-600 border-amber-200",
  Developer: "bg-navy-50 text-navy-600 border-navy-200",
};

export function Integrations() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-24 lg:py-32 bg-gray-50 relative overflow-hidden">
      <div className="absolute w-[500px] h-[500px] bottom-[-15%] right-[-15%] rounded-full bg-gradient-to-tl from-navy-200/20 to-teal-100/10 blur-[120px]" />
      <div className="absolute w-[400px] h-[400px] top-[-10%] left-[-10%] rounded-full bg-gradient-to-br from-gold-200/10 to-navy-100/5 blur-[100px]" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-3.5 py-1 mb-5 text-xs font-semibold uppercase tracking-widest text-navy-600">
            Integrations
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-navy-900 tracking-tight mb-4 leading-tight">
            Seamless Integrations with Your Tech Stack
          </h2>
          <p className="text-base lg:text-lg text-gray-500 max-w-2xl mx-auto">
            Connect your AI agents to the tools you already use. Every integration works out of the box — no code required.
          </p>
        </motion.div>

        {/* Category pills */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-2 mb-12"
        >
          {categories.map((cat) => (
            <div
              key={cat}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-[11px] font-semibold border uppercase tracking-wider",
                categoryStyles[cat]
              )}
            >
              {cat}
            </div>
          ))}
        </motion.div>

        {/* Integration grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {integrations.map((intg, i) => (
            <motion.div
              key={intg.name}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.04, duration: 0.4 }}
              className={cn(
                "group relative rounded-xl border bg-white p-4 sm:p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ring-0 hover:ring-2",
                intg.border,
                intg.ring
              )}
            >
              {intg.comingSoon && (
                <span className="absolute top-2.5 right-2.5 text-[9px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Soon</span>
              )}
              <div className="flex items-start gap-3 mb-3">
                <div className={cn("w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm transition-transform duration-300 group-hover:scale-110", intg.bg, intg.text, intg.comingSoon && "opacity-60")}>
                  {intg.abbr}
                </div>
                <div className="min-w-0">
                  <h3 className={cn("text-sm font-semibold text-navy-900 truncate", intg.comingSoon && "opacity-60")}>{intg.name}</h3>
                  <span className={cn(
                    "inline-block text-[9px] font-bold uppercase tracking-widest mt-0.5 px-1.5 py-0.5 rounded",
                    categoryStyles[intg.category]
                  )}>
                    {intg.category}
                  </span>
                </div>
              </div>
              <p className={cn("text-xs text-gray-500 leading-relaxed", intg.comingSoon && "opacity-60")}>{intg.description}</p>

              {/* Hover connector line */}
              <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-0 group-hover:w-1/2 h-0.5 rounded-full bg-gradient-to-r from-transparent via-navy-300 to-transparent transition-all duration-500" />
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-center mt-12"
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <Link
              href="/features"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-navy-900 text-white font-semibold text-sm transition-all hover:bg-navy-800 hover:shadow-lg shadow-navy-900/20"
            >
              View All Integrations <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-gray-400">
              Don&apos;t see yours? We support custom webhooks and a full REST API.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
