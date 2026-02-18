"use client";

import { useState, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Phone,
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
  Stethoscope,
  Scale,
  Wrench,
  Home,
  Shield,
  TrendingUp,
  Car,
  UtensilsCrossed,
  PhoneCall,
  Mic,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const industries = [
  { id: "healthcare", label: "Healthcare & Dental", description: "Dental office receptionist", icon: Stethoscope, color: "from-emerald-500 to-teal-500" },
  { id: "legal", label: "Legal Services", description: "Law firm receptionist", icon: Scale, color: "from-navy-600 to-navy-800" },
  { id: "home-services", label: "Home Services", description: "HVAC company receptionist", icon: Wrench, color: "from-amber-500 to-orange-500" },
  { id: "real-estate", label: "Real Estate", description: "Real estate agency assistant", icon: Home, color: "from-sky-500 to-blue-600" },
  { id: "insurance", label: "Insurance", description: "Insurance agency receptionist", icon: Shield, color: "from-violet-500 to-purple-600" },
  { id: "financial-services", label: "Financial Services", description: "Financial advisor receptionist", icon: TrendingUp, color: "from-green-500 to-emerald-600" },
  { id: "automotive", label: "Automotive", description: "Auto dealership receptionist", icon: Car, color: "from-red-500 to-rose-600" },
  { id: "hospitality", label: "Hospitality", description: "Hotel & restaurant concierge", icon: UtensilsCrossed, color: "from-pink-500 to-fuchsia-500" },
];

function WaveformBar({ delay, height }: { delay: number; height: string }) {
  return (
    <motion.div
      className="w-1 rounded-full bg-gradient-to-t from-navy-400 to-teal-400"
      animate={{
        height: ["12px", height, "12px"],
      }}
      transition={{
        duration: 1.2,
        repeat: Infinity,
        delay,
        ease: "easeInOut",
      }}
    />
  );
}

function FloatingOrb({ className }: { className?: string }) {
  return (
    <div className={cn("absolute rounded-full blur-3xl opacity-20 pointer-events-none", className)} />
  );
}

export function LiveDemo() {
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, margin: "-100px" });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [callerName, setCallerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIndustry = industries.find((i) => i.id === selected);

  async function handleSubmit() {
    if (!selected || !callerName.trim() || !phoneNumber.trim() || !email.trim()) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/demo-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: selected,
          callerName: callerName.trim(),
          phoneNumber: phoneNumber.trim(),
          email: email.trim(),
          companyName: companyName.trim() || undefined,
        }),
      });

      if (!res.ok) {
        let message = "Failed to start demo call";
        try {
          const errData = await res.json();
          message = errData.error || message;
        } catch {}
        throw new Error(message);
      }

      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start call");
    } finally {
      setIsSubmitting(false);
    }
  }

  function reset() {
    setStep(1);
    setSelected(null);
    setCallerName("");
    setPhoneNumber("");
    setEmail("");
    setCompanyName("");
    setError(null);
  }

  return (
    <section id="live-demo" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Background decorations */}
      <FloatingOrb className="w-96 h-96 bg-navy-400 -top-48 -left-48 animate-blob" />
      <FloatingOrb className="w-80 h-80 bg-teal-400 -bottom-40 -right-40 animate-blob-reverse" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.04),transparent_70%)]" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-navy-950/5 px-4 py-1.5 mb-6">
            <div className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <span className="text-xs font-semibold text-navy-900 uppercase tracking-wider">Live Demo</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-navy-900 tracking-tight mb-5">
            Talk to Our AI Agent —{" "}
            <span className="bg-gradient-to-r from-navy-600 to-teal-500 bg-clip-text text-transparent">Right Now</span>
          </h2>
          <p className="text-base lg:text-lg text-gray-500 max-w-xl mx-auto">
            Select your industry, enter your phone number, and our AI agent will call you in seconds.
          </p>
        </motion.div>

        {/* Step indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="flex items-center justify-center gap-2 mb-8"
        >
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-300",
                  step >= s
                    ? "bg-navy-900 text-white shadow-lg shadow-navy-900/20"
                    : "bg-gray-200 text-gray-400"
                )}
              >
                {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div className={cn("w-12 sm:w-20 h-0.5 rounded-full transition-all duration-500", step > s ? "bg-navy-900" : "bg-gray-200")} />
              )}
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="rounded-2xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 sm:p-8 lg:p-10 shadow-xl shadow-gray-200/50"
        >
          <AnimatePresence mode="wait">
            {/* Step 1: Industry selection */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 0 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-navy-50">
                    <Mic className="w-4 h-4 text-navy-600" />
                  </div>
                  <h3 className="font-semibold text-navy-900 text-lg">Select your industry</h3>
                </div>
                <p className="text-sm text-gray-500 mb-6 ml-11">Choose an agent to speak with — each is trained for your vertical</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                  {industries.map((ind, i) => {
                    const Icon = ind.icon;
                    const isSelected = selected === ind.id;
                    return (
                      <motion.button
                        key={ind.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={inView ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
                        onClick={() => setSelected(ind.id)}
                        className={cn(
                          "group relative text-left rounded-xl border p-4 transition-all duration-200 overflow-hidden",
                          isSelected
                            ? "border-navy-600 bg-navy-900 text-white shadow-lg shadow-navy-900/20 scale-[1.02]"
                            : "border-gray-200 hover:border-navy-200 hover:shadow-md text-gray-700 hover:bg-navy-50/50"
                        )}
                      >
                        {/* Gradient accent on selected */}
                        {isSelected && (
                          <div className={cn("absolute inset-0 opacity-20 bg-gradient-to-br", ind.color)} />
                        )}
                        <div className="relative z-10">
                          <div className={cn(
                            "flex items-center justify-center w-10 h-10 rounded-lg mb-3 transition-all duration-200",
                            isSelected
                              ? "bg-white/15"
                              : "bg-gray-100 group-hover:bg-navy-100"
                          )}>
                            <Icon className={cn("w-5 h-5 transition-colors", isSelected ? "text-white" : "text-gray-500 group-hover:text-navy-600")} />
                          </div>
                          <p className="text-sm font-semibold leading-tight">{ind.label}</p>
                          <p className={cn("text-[11px] mt-1 leading-tight", isSelected ? "text-gray-300" : "text-gray-400")}>{ind.description}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                <button
                  onClick={() => selected && setStep(2)}
                  disabled={!selected}
                  className={cn(
                    "w-full flex items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-semibold transition-all duration-300",
                    selected
                      ? "bg-gradient-to-r from-navy-900 to-navy-800 text-white hover:from-navy-800 hover:to-navy-700 shadow-lg shadow-navy-900/25 hover:shadow-xl hover:shadow-navy-900/30"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  )}
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* Step 2: Enter info */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-navy-900 mb-5 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>

                <div className="grid lg:grid-cols-[1fr_280px] gap-8">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-navy-50">
                        <PhoneCall className="w-4 h-4 text-navy-600" />
                      </div>
                      <h3 className="font-semibold text-navy-900 text-lg">Your information</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-6 ml-11">
                      Enter your details and we&apos;ll call you right away
                    </p>

                    <div className="space-y-4 mb-6">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name *</label>
                          <input
                            type="text"
                            value={callerName}
                            onChange={(e) => setCallerName(e.target.value)}
                            placeholder="e.g. Sarah Johnson"
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-navy-400 focus:ring-2 focus:ring-navy-400/20 outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number *</label>
                          <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="e.g. (555) 123-4567"
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-navy-400 focus:ring-2 focus:ring-navy-400/20 outline-none transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="e.g. sarah@example.com"
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-navy-400 focus:ring-2 focus:ring-navy-400/20 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name <span className="text-gray-400 font-normal">(optional)</span></label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="e.g. Acme Corp"
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-navy-400 focus:ring-2 focus:ring-navy-400/20 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={!callerName.trim() || !phoneNumber.trim() || !email.trim() || isSubmitting}
                      className={cn(
                        "w-full flex items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-semibold transition-all duration-300",
                        callerName.trim() && phoneNumber.trim() && email.trim() && !isSubmitting
                          ? "bg-gradient-to-r from-navy-900 to-navy-800 text-white hover:from-navy-800 hover:to-navy-700 shadow-lg shadow-navy-900/25"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      )}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Phone className="w-4 h-4" /> Call Me Now
                        </>
                      )}
                    </button>
                  </div>

                  {/* Side preview card */}
                  <div className="hidden lg:flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-navy-950 to-navy-900 p-6 text-center">
                    <div className={cn("w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-lg", selectedIndustry?.color || "from-navy-600 to-navy-800")}>
                      {selectedIndustry && <selectedIndustry.icon className="w-7 h-7 text-white" />}
                    </div>
                    <p className="text-white font-semibold text-sm mb-1">{selectedIndustry?.label}</p>
                    <p className="text-gray-400 text-xs mb-5">{selectedIndustry?.description}</p>
                    <div className="flex items-end gap-1 h-8">
                      <WaveformBar delay={0} height="24px" />
                      <WaveformBar delay={0.15} height="32px" />
                      <WaveformBar delay={0.3} height="20px" />
                      <WaveformBar delay={0.1} height="28px" />
                      <WaveformBar delay={0.25} height="16px" />
                      <WaveformBar delay={0.05} height="30px" />
                      <WaveformBar delay={0.2} height="22px" />
                    </div>
                    <p className="text-gray-500 text-[10px] mt-4 uppercase tracking-wider">AI Agent Ready</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Call dispatched */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center py-10"
              >
                {/* Pulsing phone animation */}
                <div className="relative mb-8">
                  <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" style={{ animationDuration: "2s" }} />
                  <div className="absolute -inset-3 rounded-full bg-emerald-400/10 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.3s" }} />
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                    <Phone className="w-9 h-9 text-white" />
                  </div>
                </div>

                <p className="font-display font-bold text-navy-900 text-2xl mb-2">
                  Calling you now!
                </p>
                <p className="text-sm text-gray-500 text-center max-w-sm mb-2">
                  Our {selectedIndustry?.label || ""} AI agent is calling{" "}
                  <span className="font-semibold text-navy-900">{phoneNumber}</span>
                </p>
                <p className="text-xs text-gray-400 mb-3">Pick up your phone to start the conversation.</p>

                {/* Waveform animation */}
                <div className="flex items-end gap-1 h-8 mb-8">
                  <WaveformBar delay={0} height="20px" />
                  <WaveformBar delay={0.1} height="32px" />
                  <WaveformBar delay={0.2} height="16px" />
                  <WaveformBar delay={0.15} height="28px" />
                  <WaveformBar delay={0.25} height="24px" />
                  <WaveformBar delay={0.05} height="30px" />
                  <WaveformBar delay={0.3} height="18px" />
                  <WaveformBar delay={0.12} height="26px" />
                  <WaveformBar delay={0.22} height="14px" />
                </div>

                <button
                  onClick={reset}
                  className="text-sm font-semibold text-navy-600 hover:text-navy-800 transition-colors flex items-center gap-1.5"
                >
                  <Volume2 className="w-4 h-4" /> Try another industry
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-red-500 text-center mt-4 bg-red-50 rounded-lg py-2 px-4"
            >
              {error}
            </motion.p>
          )}

          <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <Shield className="w-3 h-3" /> Not recorded or stored
            </div>
            <div className="w-px h-3 bg-gray-200" />
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <Phone className="w-3 h-3" /> Standard rates may apply
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
