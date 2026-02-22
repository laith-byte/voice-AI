"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { Check, ChevronDown, ArrowRight, Loader2, ShieldCheck, X, Phone, Headphones, Bot, Wrench, FileText, FlaskConical, TrendingUp, BrainCircuit, AudioLines, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useInView } from "framer-motion";

// --- Inline cost data (mirrors Retell pricing) ---
const INFRA_COST = 0.055;
const TELEPHONY_COST = 0.015;

const LLM_MODELS = [
  { label: "GPT-4.1 Nano", key: "gpt-4.1-nano", cost: 0.004 },
  { label: "GPT-4.1 Mini", key: "gpt-4.1-mini", cost: 0.012 },
  { label: "GPT-4.1", key: "gpt-4.1", cost: 0.045 },
  { label: "GPT-4o", key: "gpt-4o", cost: 0.045 },
  { label: "GPT-4o Mini", key: "gpt-4o-mini", cost: 0.012 },
  { label: "GPT-5", key: "gpt-5", cost: 0.045 },
  { label: "GPT-5 Mini", key: "gpt-5-mini", cost: 0.012 },
  { label: "Claude 4.5 Sonnet", key: "claude-4.5-sonnet", cost: 0.08 },
] as const;

const VOICE_PROVIDERS = [
  { label: "OpenAI", key: "openai", cost: 0 },
  { label: "Deepgram", key: "deepgram", cost: 0.007 },
  { label: "ElevenLabs", key: "elevenlabs", cost: 0.015 },
  { label: "Cartesia", key: "cartesia", cost: 0.015 },
] as const;

const ADDON_COSTS = { knowledgeBase: 0.005, advancedDenoising: 0.005, piiRemoval: 0.01 };

/**
 * Standard baseline config used to calculate the base overage rate.
 * Platform cost for this config: $0.055 + $0.015 + $0.012 + $0.000 = $0.082/min
 * Any config that costs more than this adds the delta to the plan's base overage rate.
 */
const STANDARD_CONFIG_COST = INFRA_COST + TELEPHONY_COST + 0.012 + 0; // GPT-4.1 Mini + OpenAI voice

/** Plan-level base overage rates and included minutes */
const PLAN_DETAILS: Record<string, { baseOverage: number; includedMinutes: number }> = {
  starter: { baseOverage: 0.35, includedMinutes: 400 },
  professional: { baseOverage: 0.30, includedMinutes: 800 },
};

const plans = [
  {
    name: "Starter",
    slug: "starter",
    description: "Perfect for small businesses getting started with AI voice agents.",
    monthlyPrice: 499,
    annualPrice: 399,
    agents: "1",
    minutes: "400",
    phoneNumbers: "1",
    concurrentCalls: "5",
    knowledgeBases: "1",
    overage: "from $0.35/min",
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Professional",
    slug: "professional",
    description: "For growing businesses that need more capacity and agents.",
    monthlyPrice: 899,
    annualPrice: 719,
    agents: "3",
    minutes: "800",
    phoneNumbers: "3",
    concurrentCalls: "10",
    knowledgeBases: "3",
    overage: "from $0.30/min",
    cta: "Get Started",
    highlighted: true,
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    description: "For large organizations with custom deployment and volume needs.",
    monthlyPrice: null,
    annualPrice: null,
    agents: "Custom",
    minutes: "Custom",
    phoneNumbers: "Custom",
    concurrentCalls: "Custom",
    knowledgeBases: "Custom",
    overage: "Custom",
    cta: "Contact Sales",
    highlighted: false,
  },
];

const allFeatures: { name: string; display?: "check" | "text"; text?: string }[] = [
  { name: "Full analytics suite & AI call evaluation" },
  { name: "24/7 inbound & outbound calls" },
  { name: "Natural, human-like conversations" },
  { name: "Appointment scheduling (Google Calendar)" },
  { name: "Call transfer to humans" },
  { name: "Knowledge base integration" },
  { name: "CRM integration (HubSpot, Salesforce, GoHighLevel & more)" },
  { name: "SMS & email follow-up automation" },
  { name: "Post-call analysis & transcripts" },
  { name: "Slack & webhook integrations" },
  { name: "Advanced voice & LLM selection" },
  { name: "Raw prompt editor & functions/tools" },
  { name: "Campaign outbound calling" },
  { name: "Pronunciation dictionary" },
  { name: "HIPAA compliance, PII redaction & custom branding" },
  { name: "Priority support & dedicated account manager" },
  { name: "Verified Caller ID (included)" },
  { name: "Branded Caller ID ($59/mo add-on)", display: "text", text: "$59/mo" },
];

const faqs = [
  {
    question: "What counts as a minute?",
    answer: "A minute is measured from when the AI agent connects to a call until the call ends. Both inbound and outbound calls count toward your included minutes. Partial minutes are rounded to the nearest second.",
  },
  {
    question: "Can I change plans anytime?",
    answer: "Yes. You can upgrade or downgrade your plan at any time. When you upgrade, the new capacity is available immediately. When you downgrade, the change takes effect at the start of your next billing cycle.",
  },
  {
    question: "What happens if I go over my included minutes?",
    answer: "Overage minutes are billed at your plan\u2019s base rate (Starter: from $0.35/min, Professional: from $0.30/min, Enterprise: custom). The base rate covers a standard agent configuration \u2014 if you choose a more advanced AI model or premium voice provider, the cost difference is added to your base rate. Your calls are never interrupted \u2014 we just bill the overage at the end of the cycle. Use the cost estimator below to see your exact rate.",
  },
  {
    question: "Why does my overage rate depend on agent configuration?",
    answer: "Different AI models and voice providers have different underlying costs \u2014 for example, GPT-4.1 Nano costs significantly less per minute than Claude 4.5 Sonnet. Rather than pricing everyone at the highest tier, we pass through the actual cost difference so you only pay for what you use. The base overage rate covers a standard setup (GPT-4.1 Mini + OpenAI voice + telephony). If your agent uses a more expensive model or voice, the difference is added to your base rate.",
  },
  {
    question: "Do you offer a free trial?",
    answer: "We offer a personalized demo where you can hear your industry template handle real call scenarios. Contact our team to schedule a demo and discuss trial options for your specific use case.",
  },
  {
    question: "Is there a setup fee?",
    answer: "No. There are no setup fees on any plan. You can get started immediately after subscribing.",
  },
  {
    question: "What\u2019s included in all plans?",
    answer: "Every plan includes the full platform: analytics, AI evaluation, automations, CRM integrations, advanced agent configuration, HIPAA compliance, priority support, and more. You only upgrade when you need more agents, minutes, or phone numbers.",
  },
  {
    question: "What\u2019s the difference between Verified and Branded Caller ID?",
    answer: "Verified Caller ID is included free with every plan — it authenticates your calls using STIR/SHAKEN protocols so carriers know your number is legitimate, reducing the chance of being flagged as spam. Branded Caller ID ($59/mo per agent) goes a step further: it displays your business name, logo, and the reason for the call directly on the recipient\u2019s phone screen, building instant trust and increasing answer rates by up to 3x.",
  },
];

function CostEstimator() {
  const [selectedPlan, setSelectedPlan] = useState<string>("professional");
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4.1-mini");
  const [selectedVoice, setSelectedVoice] = useState<string>("openai");
  const [hasPhone, setHasPhone] = useState(true);
  const [hasKnowledgeBase, setHasKnowledgeBase] = useState(false);
  const [hasDenoising, setHasDenoising] = useState(false);
  const [hasPii, setHasPii] = useState(false);

  const breakdown = useMemo(() => {
    const llm = LLM_MODELS.find((m) => m.key === selectedModel)?.cost ?? 0.045;
    const voice = VOICE_PROVIDERS.find((v) => v.key === selectedVoice)?.cost ?? 0;
    const telephony = hasPhone ? TELEPHONY_COST : 0;
    const kb = hasKnowledgeBase ? ADDON_COSTS.knowledgeBase : 0;
    const denoising = hasDenoising ? ADDON_COSTS.advancedDenoising : 0;
    const pii = hasPii ? ADDON_COSTS.piiRemoval : 0;
    const platformCost = INFRA_COST + telephony + llm + voice + kb + denoising + pii;

    // Delta above the standard config baseline
    const configDelta = Math.max(0, platformCost - STANDARD_CONFIG_COST);
    const plan = PLAN_DETAILS[selectedPlan] ?? PLAN_DETAILS.professional;
    const baseOverage = plan.baseOverage;
    const finalRate = Math.round((baseOverage + configDelta) * 1000) / 1000;

    // Included minutes budget: plan includes X minutes at the base rate.
    // With a more expensive config, the effective included minutes shrink.
    const minuteBudget = plan.includedMinutes * baseOverage; // dollar value of included minutes
    const effectiveMinutes = Math.floor(minuteBudget / finalRate);

    return {
      infrastructure: INFRA_COST, telephony, llm, voice, kb, denoising, pii,
      platformCost, configDelta, baseOverage, finalRate,
      includedMinutes: plan.includedMinutes, effectiveMinutes, minuteBudget,
    };
  }, [selectedPlan, selectedModel, selectedVoice, hasPhone, hasKnowledgeBase, hasDenoising, hasPii]);

  const estimatorRef = useRef(null);
  const estimatorInView = useInView(estimatorRef, { once: true, margin: "-80px" });

  return (
    <section ref={estimatorRef} className="py-24 lg:py-32 bg-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={estimatorInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Transparent Pricing</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight mb-4">
            Per-Minute Cost Estimator
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Your per-minute rate and effective included minutes depend on the AI model, voice provider, and add-ons you choose. See exactly how your configuration affects your plan.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={estimatorInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="rounded-2xl border border-gray-200 bg-white shadow-lg shadow-gray-200/50 overflow-hidden"
        >
          <div className="grid md:grid-cols-2">
            {/* Configuration side */}
            <div className="p-6 sm:p-8 space-y-5 border-b md:border-b-0 md:border-r border-gray-100">
              <h3 className="text-sm font-semibold text-navy-900 uppercase tracking-wider">Configure</h3>

              {/* Plan */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Your Plan</label>
                <div className="flex gap-2">
                  {[
                    { key: "starter", label: "Starter", mins: "400", base: "$0.35" },
                    { key: "professional", label: "Professional", mins: "800", base: "$0.30" },
                  ].map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setSelectedPlan(p.key)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all text-left",
                        selectedPlan === p.key
                          ? "border-navy-900 bg-navy-900 text-white"
                          : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                      )}
                    >
                      {p.label}
                      <span className={cn("block text-[10px] mt-0.5", selectedPlan === p.key ? "text-white/60" : "text-gray-400")}>
                        {p.mins} mins/mo · base {p.base}/min
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Model */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
                  <BrainCircuit className="w-3.5 h-3.5" />
                  AI Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900/30 transition-all"
                >
                  {LLM_MODELS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label} — ${m.cost.toFixed(3)}/min
                    </option>
                  ))}
                </select>
              </div>

              {/* Voice Provider */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
                  <AudioLines className="w-3.5 h-3.5" />
                  Voice Provider
                </label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900/30 transition-all"
                >
                  {VOICE_PROVIDERS.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label}{v.cost > 0 ? ` — $${v.cost.toFixed(3)}/min` : " — included"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={hasPhone} onChange={(e) => setHasPhone(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-navy-900 focus:ring-navy-900/20" />
                  <span className="text-sm text-gray-700 group-hover:text-navy-900 transition-colors">Phone calls <span className="text-gray-400">(+${TELEPHONY_COST.toFixed(3)}/min)</span></span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={hasKnowledgeBase} onChange={(e) => setHasKnowledgeBase(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-navy-900 focus:ring-navy-900/20" />
                  <span className="text-sm text-gray-700 group-hover:text-navy-900 transition-colors">Knowledge base <span className="text-gray-400">(+${ADDON_COSTS.knowledgeBase.toFixed(3)}/min)</span></span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={hasDenoising} onChange={(e) => setHasDenoising(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-navy-900 focus:ring-navy-900/20" />
                  <span className="text-sm text-gray-700 group-hover:text-navy-900 transition-colors">Advanced denoising <span className="text-gray-400">(+${ADDON_COSTS.advancedDenoising.toFixed(3)}/min)</span></span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={hasPii} onChange={(e) => setHasPii(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-navy-900 focus:ring-navy-900/20" />
                  <span className="text-sm text-gray-700 group-hover:text-navy-900 transition-colors">PII redaction <span className="text-gray-400">(+${ADDON_COSTS.piiRemoval.toFixed(3)}/min)</span></span>
                </label>
              </div>
            </div>

            {/* Results side */}
            <div className="p-6 sm:p-8 bg-gray-50/50 flex flex-col">
              {/* Included minutes — lead with the free value */}
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 mb-4">
                <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wider mb-1">Included free with your plan</p>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">Minutes / month</span>
                  <span className="text-2xl font-bold text-navy-900 tabular-nums">{breakdown.effectiveMinutes.toLocaleString()}</span>
                </div>
                {breakdown.effectiveMinutes < breakdown.includedMinutes ? (
                  <div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                      <div
                        className="bg-gradient-to-r from-amber-400 to-amber-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(10, (breakdown.effectiveMinutes / breakdown.includedMinutes) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-amber-600">
                      {breakdown.includedMinutes - breakdown.effectiveMinutes} fewer free minutes vs. standard config ({breakdown.includedMinutes})
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                      <div className="bg-gradient-to-r from-teal-400 to-teal-500 h-2 rounded-full w-full" />
                    </div>
                    <p className="text-[11px] text-teal-600">
                      Full {breakdown.includedMinutes} free minutes at standard config
                    </p>
                  </div>
                )}
              </div>

              {/* Overage rate — clearly labeled as after included minutes */}
              <div className="rounded-xl bg-navy-900 text-white px-5 py-4 mb-5">
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">After included minutes</p>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-white/60">Overage rate</span>
                  <span className="text-3xl font-bold tabular-nums">${breakdown.finalRate.toFixed(2)}<span className="text-base font-normal text-white/50">/min</span></span>
                </div>
                {breakdown.configDelta > 0 && (
                  <p className="text-[11px] text-white/40 mt-1">Base ${breakdown.baseOverage.toFixed(2)} + ${breakdown.configDelta.toFixed(3)} config adjustment</p>
                )}
              </div>

              {/* Platform cost breakdown — collapsed detail */}
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">What&apos;s included in every minute</p>
                <div className="space-y-1.5 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5"><Server className="w-3 h-3" /> Infrastructure</span>
                    <span className="tabular-nums">${breakdown.infrastructure.toFixed(3)}</span>
                  </div>
                  {breakdown.telephony > 0 && (
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> Telephony</span>
                      <span className="tabular-nums">${breakdown.telephony.toFixed(3)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5"><BrainCircuit className="w-3 h-3" /> AI Model</span>
                    <span className="tabular-nums">${breakdown.llm.toFixed(3)}</span>
                  </div>
                  {breakdown.voice > 0 && (
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1.5"><AudioLines className="w-3 h-3" /> Voice</span>
                      <span className="tabular-nums">${breakdown.voice.toFixed(3)}</span>
                    </div>
                  )}
                  {breakdown.kb > 0 && (
                    <div className="flex justify-between"><span>Knowledge Base</span><span className="tabular-nums">${breakdown.kb.toFixed(3)}</span></div>
                  )}
                  {breakdown.denoising > 0 && (
                    <div className="flex justify-between"><span>Adv. Denoising</span><span className="tabular-nums">${breakdown.denoising.toFixed(3)}</span></div>
                  )}
                  {breakdown.pii > 0 && (
                    <div className="flex justify-between"><span>PII Redaction</span><span className="tabular-nums">${breakdown.pii.toFixed(3)}</span></div>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-gray-400 mt-4 leading-relaxed">
                Standard config = GPT-4.1 Mini + OpenAI voice + telephony. Premium models and add-ons increase your per-minute rate, reducing your effective included minutes.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const cardsRef = useRef(null);
  const cardsInView = useInView(cardsRef, { once: true, margin: "-100px" });
  const callerIdRef = useRef(null);
  const callerIdInView = useInView(callerIdRef, { once: true, margin: "-100px" });
  const comparisonRef = useRef(null);
  const comparisonInView = useInView(comparisonRef, { once: true, margin: "-100px" });
  const whiteGloveRef = useRef(null);
  const whiteGloveInView = useInView(whiteGloveRef, { once: true, margin: "-100px" });
  const faqRef = useRef(null);
  const faqInView = useInView(faqRef, { once: true, margin: "-100px" });
  const ctaRef = useRef(null);
  const ctaInView = useInView(ctaRef, { once: true, margin: "-100px" });

  async function handleCheckout(slug: string) {
    setLoadingPlan(slug);
    try {
      const res = await fetch("/api/marketing-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: slug,
          billing_period: annual ? "yearly" : "monthly",
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout error:", data.error);
        setLoadingPlan(null);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setLoadingPlan(null);
    }
  }

  return (
    <main>
      {/* Hero */}
      <section className="relative pt-[72px]">
        <div className="mx-3 sm:mx-4 lg:mx-6">
          <div className="relative overflow-hidden rounded-2xl lg:rounded-3xl py-20 lg:py-28">
            <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900" />
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }} />
            <div className="relative z-10 mx-auto max-w-4xl px-6 sm:px-10 text-center">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-white/50 mb-6"
              >
                Pricing
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-6"
              >
                Simple, Transparent Pricing
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-base sm:text-lg text-white/60 max-w-2xl mx-auto mb-10"
              >
                Every plan includes every feature — plus hundreds of free minutes each month. You only upgrade when you need more capacity.
              </motion.p>

              {/* Toggle */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1"
              >
                <button
                  onClick={() => setAnnual(false)}
                  className={cn(
                    "px-5 py-2 rounded-full text-sm font-medium transition-all",
                    !annual ? "bg-white text-navy-900" : "text-white/60 hover:text-white"
                  )}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setAnnual(true)}
                  className={cn(
                    "px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                    annual ? "bg-white text-navy-900" : "text-white/60 hover:text-white"
                  )}
                >
                  Annual
                  <span className="text-[10px] bg-teal-400 text-navy-900 px-2 py-0.5 rounded-full font-bold">-20%</span>
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section ref={cardsRef} className="py-16 relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-5 -mt-16">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                animate={cardsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className={cn(
                  "rounded-xl border bg-white relative transition-all duration-300 overflow-hidden",
                  plan.highlighted
                    ? "border-navy-900 shadow-xl shadow-navy-900/10 ring-1 ring-navy-900 hover:shadow-2xl hover:shadow-navy-900/15 md:scale-105 md:z-10"
                    : "border-gray-200 hover:border-gold-300 hover:shadow-lg hover:shadow-gold-400/10"
                )}
              >
                {plan.highlighted && (
                  <div className="h-1 bg-gradient-to-r from-teal-400 via-navy-600 to-gold-400" />
                )}
                <div className="p-8">
                {plan.highlighted && (
                  <div className="absolute top-5 right-4 bg-gradient-to-r from-gold-400 to-gold-300 text-navy-900 text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full">
                    Best Value
                  </div>
                )}
                <h3 className="text-lg font-semibold text-navy-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-500 mb-6">{plan.description}</p>

                <div className="mb-6">
                  {plan.monthlyPrice ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-navy-900">
                        ${annual ? plan.annualPrice : plan.monthlyPrice}
                      </span>
                      <span className="text-gray-400 text-sm">/mo</span>
                    </div>
                  ) : (
                    <span className="text-4xl font-bold text-navy-900">Custom</span>
                  )}
                  {annual && plan.monthlyPrice && (
                    <p className="text-xs text-gray-400 mt-1">Billed annually</p>
                  )}
                </div>

                {plan.slug === "enterprise" ? (
                  <div className="space-y-3 mb-8 pb-8 border-b border-gray-100">
                    <p className="text-sm text-gray-500 mb-1">Everything in Professional, plus:</p>
                    {[
                      "Unlimited AI agents & phone numbers",
                      "Custom minute volume & overage rates",
                      "Dedicated account manager",
                      "Custom integrations & SLA",
                      "HIPAA BAA & compliance review",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2.5 text-sm">
                        <Check className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                        <span className="text-gray-700">{item}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 mb-8 pb-8 border-b border-gray-100">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">AI Agents</span>
                      <span className={cn("font-medium", plan.highlighted ? "font-semibold text-navy-900" : "text-navy-900")}>{plan.agents}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm -mx-3 px-3 py-1.5 rounded-lg bg-teal-50/60">
                      <span className="text-teal-700/70">Minutes / month</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-teal-700">{plan.minutes}</span>
                        <span className="text-[10px] font-semibold text-teal-600/80 uppercase tracking-wide">included</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Phone Numbers</span>
                      <span className={cn("font-medium", plan.highlighted ? "font-semibold text-navy-900" : "text-navy-900")}>{plan.phoneNumbers}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Concurrent Calls</span>
                      <span className={cn("font-medium", plan.highlighted ? "font-semibold text-navy-900" : "text-navy-900")}>{plan.concurrentCalls}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Knowledge Bases</span>
                      <span className={cn("font-medium", plan.highlighted ? "font-semibold text-navy-900" : "text-navy-900")}>{plan.knowledgeBases}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Overage Rate</span>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("font-medium", plan.highlighted ? "font-semibold text-navy-900" : "text-navy-900")}>{plan.overage}</span>
                        {plan.highlighted && (
                          <span className="text-[10px] font-medium text-teal-600">save 14%</span>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 pt-1">Base rate for standard config. Final rate depends on your agent&apos;s AI model, voice, and add-ons.</p>
                  </div>
                )}

                {plan.slug === "enterprise" ? (
                  <Link
                    href="/contact"
                    className="block w-full text-center rounded-lg py-3 text-sm font-semibold transition-all hover:scale-[1.02] bg-gray-100 text-navy-900 hover:bg-gray-200"
                  >
                    {plan.cta}
                  </Link>
                ) : (
                  <button
                    onClick={() => handleCheckout(plan.slug)}
                    disabled={loadingPlan === plan.slug}
                    className={cn(
                      "block w-full text-center rounded-lg py-3 text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-70",
                      plan.highlighted
                        ? "bg-navy-900 text-white hover:bg-navy-800"
                        : "bg-gray-100 text-navy-900 hover:bg-gray-200"
                    )}
                  >
                    {loadingPlan === plan.slug ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      plan.cta
                    )}
                  </button>
                )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* White Glove Deployments */}
      <section ref={whiteGloveRef} className="py-24 lg:py-32 relative overflow-hidden">
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
            animate={whiteGloveInView ? { opacity: 1, y: 0 } : {}}
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
            {[
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
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                animate={whiteGloveInView ? { opacity: 1, y: 0 } : {}}
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
            animate={whiteGloveInView ? { opacity: 1, y: 0 } : {}}
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

      {/* Branded Caller ID */}
      <section ref={callerIdRef} className="py-24 lg:py-32 bg-white relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute w-[40%] h-[40%] top-[-10%] right-[-10%] rounded-full bg-gradient-to-br from-teal-200/30 to-teal-400/10 blur-[100px]" />
        <div className="absolute w-[35%] h-[35%] bottom-[-10%] left-[-10%] rounded-full bg-gradient-to-tr from-navy-200/20 to-navy-400/10 blur-[100px]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={callerIdInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 bg-navy-900/5 border border-navy-900/10 rounded-full px-4 py-1.5 mb-6">
              <ShieldCheck className="w-4 h-4 text-navy-900" />
              <span className="text-xs font-semibold text-navy-900 uppercase tracking-wider">Add-On</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight mb-4">
              Branded Caller ID
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Display your business name, logo, and call reason on every outbound call. Increase answer rates by up to 3x.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Phone Mockups */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={callerIdInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="flex items-center justify-center gap-6 sm:gap-10"
            >
              {/* Standard Phone */}
              <div className="relative">
                <div className="text-center mb-3">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Standard</span>
                </div>
                <div className="w-[160px] sm:w-[180px] rounded-[28px] border-2 border-gray-200 bg-gray-50 p-3 shadow-lg">
                  <div className="rounded-[20px] bg-white overflow-hidden">
                    {/* Status bar */}
                    <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
                      <span className="text-[9px] text-gray-400 font-medium">9:41</span>
                      <div className="flex gap-1">
                        <div className="w-3 h-1.5 bg-gray-300 rounded-sm" />
                        <div className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                      </div>
                    </div>
                    {/* Call screen */}
                    <div className="px-4 py-8 text-center">
                      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                        <Phone className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mb-1">(555) 123-4567</p>
                      <p className="text-[11px] text-gray-400">Mobile</p>
                    </div>
                    {/* Action buttons */}
                    <div className="px-4 pb-6 flex justify-center gap-6">
                      <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                        <X className="w-4 h-4 text-white" />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Branded Phone */}
              <div className="relative">
                <div className="text-center mb-3">
                  <span className="text-[11px] font-semibold text-teal-600 uppercase tracking-wider">With Branded ID</span>
                </div>
                <div className="w-[160px] sm:w-[180px] rounded-[28px] border-2 border-teal-200 bg-teal-50/30 p-3 shadow-xl shadow-teal-500/10 ring-1 ring-teal-400/20">
                  <div className="rounded-[20px] bg-white overflow-hidden">
                    {/* Status bar */}
                    <div className="bg-teal-50 px-4 py-2 flex items-center justify-between">
                      <span className="text-[9px] text-teal-600 font-medium">9:41</span>
                      <div className="flex gap-1">
                        <div className="w-3 h-1.5 bg-teal-300 rounded-sm" />
                        <div className="w-1.5 h-1.5 bg-teal-300 rounded-full" />
                      </div>
                    </div>
                    {/* Call screen */}
                    <div className="px-4 py-8 text-center">
                      <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-3 ring-2 ring-teal-200">
                        <span className="text-lg font-bold text-teal-700">AB</span>
                      </div>
                      <div className="inline-flex items-center gap-1 bg-teal-50 border border-teal-200 rounded-full px-2.5 py-0.5 mb-3">
                        <ShieldCheck className="w-3 h-3 text-teal-600" />
                        <span className="text-[10px] font-semibold text-teal-700">Verified Business</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mb-1">Acme Business</p>
                      <p className="text-[11px] text-teal-600 font-medium">Appointment Reminder</p>
                    </div>
                    {/* Action buttons */}
                    <div className="px-4 pb-6 flex justify-center gap-6">
                      <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                        <X className="w-4 h-4 text-white" />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Benefits + CTA */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={callerIdInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <h3 className="font-display text-2xl font-bold text-navy-900 tracking-tight mb-2">
                Turn unknown numbers into trusted calls
              </h3>
              <p className="text-gray-500 mb-8">
                $59/mo per agent. Available as an add-on to any plan.
              </p>

              <div className="space-y-4 mb-8">
                {[
                  "Display your business name on the caller's screen",
                  "Show your logo and brand colors",
                  "Include the reason for the call",
                  "\"Verified Business\" badge builds instant trust",
                  "Increase answer rates by up to 3x",
                  "Reduce spam flags and blocked calls",
                ].map((benefit, i) => (
                  <motion.div
                    key={benefit}
                    initial={{ opacity: 0, y: 10 }}
                    animate={callerIdInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
                    className="flex items-start gap-3"
                  >
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-teal-600" />
                    </div>
                    <span className="text-sm text-gray-700">{benefit}</span>
                  </motion.div>
                ))}
              </div>

              <div className="bg-teal-50/50 rounded-xl border border-teal-200/60 p-4 mb-8">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-navy-900 mb-1">Verified Caller ID included free</p>
                    <p className="text-xs text-gray-500">
                      Every plan includes Verified Caller ID at no extra cost — your calls are authenticated and less likely to be flagged as spam. Branded Caller ID goes further by displaying your business name, logo, and call reason.
                    </p>
                  </div>
                </div>
              </div>

              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-navy-900 text-white font-semibold text-sm transition-all hover:bg-navy-800"
              >
                Add to Any Plan <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section ref={comparisonRef} className="py-24 lg:py-32 bg-navy-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={comparisonInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <p className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-3">All Included</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              All Features. Every Plan.
            </h2>
            <p className="text-white/50">
              We don&apos;t gate features behind higher tiers. Every plan includes the full platform.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={comparisonInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden"
          >
            <div className="grid grid-cols-4 gap-4 px-6 py-3.5 bg-white/5 border-b border-white/10">
              <div className="text-xs font-semibold text-white/40 uppercase tracking-wider">Feature</div>
              <div className="text-xs font-semibold text-white text-center uppercase tracking-wider">Starter</div>
              <div className="text-xs font-semibold text-white text-center uppercase tracking-wider">Pro</div>
              <div className="text-xs font-semibold text-white text-center uppercase tracking-wider">Enterprise</div>
            </div>
            {allFeatures.map((feat, i) => (
              <div key={feat.name} className={cn(
                "grid grid-cols-4 gap-4 px-6 py-3 items-center transition-colors hover:bg-white/[0.04]",
                i < allFeatures.length - 1 && "border-b border-white/5",
                i % 2 === 1 && "bg-white/[0.02]"
              )}>
                <div className="text-sm text-white/70">{feat.name}</div>
                {[0, 1, 2].map((col) => (
                  <div key={col} className="flex justify-center">
                    {feat.display === "text" ? (
                      <span className="text-xs font-semibold text-white bg-white/10 px-2.5 py-1 rounded-full">{feat.text}</span>
                    ) : (
                      <Check className="w-4 h-4 text-teal-400" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Cost Estimator */}
      <CostEstimator />

      {/* FAQ */}
      <section ref={faqRef} className="py-24 lg:py-32 bg-gray-50/50">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={faqInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight">
              Frequently Asked Questions
            </h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={faqInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="space-y-3"
          >
            {faqs.map((faq, i) => (
              <div key={i} className={cn(
                "rounded-xl border overflow-hidden bg-white transition-all duration-200",
                openFaq === i
                  ? "border-navy-900/20 shadow-md shadow-navy-900/5"
                  : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
              )}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50/50"
                >
                  <span className="font-medium text-navy-900 text-sm">{faq.question}</span>
                  <ChevronDown className={cn(
                    "w-4 h-4 transition-all duration-200 shrink-0 ml-4",
                    openFaq === i ? "rotate-180 text-navy-900" : "text-gray-400"
                  )} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-4 text-sm text-gray-500 leading-relaxed">{faq.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24 lg:pb-32">
        <div className="mx-3 sm:mx-4 lg:mx-6">
          <div ref={ctaRef} className="relative overflow-hidden rounded-2xl lg:rounded-3xl py-20 lg:py-24">
            <div
              className="absolute inset-0 animate-gradient"
              style={{
                background: "linear-gradient(135deg, #0a0e2a 0%, #111842 20%, #0f172a 40%, #1a1f3d 55%, #0d1117 70%, #151b33 85%, #0a0e2a 100%)",
                backgroundSize: "300% 300%",
              }}
            />
            {/* Animated blobs */}
            <div className="absolute w-[50%] h-[50%] top-[-15%] right-[-10%] rounded-full bg-gradient-to-br from-navy-700/40 to-navy-500/20 blur-[80px] animate-blob" />
            <div className="absolute w-[40%] h-[40%] bottom-[-15%] left-[-10%] rounded-full bg-gradient-to-tr from-navy-800/50 to-indigo-600/20 blur-[80px] animate-blob-reverse" />
            <div className="absolute w-[30%] h-[30%] top-[25%] left-[30%] rounded-full bg-gradient-to-r from-navy-600/15 to-indigo-500/10 blur-[60px] animate-blob-slow" />
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }} />
            <div className="relative z-10 mx-auto max-w-3xl px-6 sm:px-10 text-center">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={ctaInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0 }}
                className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4"
              >
                Not Sure Which Plan Is Right?
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={ctaInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="text-base sm:text-lg text-white/60 mb-8"
              >
                Book a call with our team. We&apos;ll help you estimate your usage and find the perfect fit.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={ctaInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-white text-navy-900 font-semibold text-sm transition-all hover:bg-gray-100 hover:scale-[1.02]"
                >
                  Book a Call <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
