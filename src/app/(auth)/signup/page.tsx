"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    slug: "starter",
    description: "For small businesses getting started with AI voice agents.",
    monthlyPrice: 499,
    annualPrice: 399,
    highlights: ["1 AI Agent", "400 minutes/mo included", "1 phone number", "5 concurrent calls"],
    highlighted: false,
  },
  {
    name: "Professional",
    slug: "professional",
    description: "For growing businesses that need more capacity.",
    monthlyPrice: 899,
    annualPrice: 719,
    highlights: ["3 AI Agents", "800 minutes/mo included", "3 phone numbers", "10 concurrent calls"],
    highlighted: true,
  },
];

const includedFeatures = [
  "Full analytics & AI call evaluation",
  "24/7 inbound & outbound calls",
  "CRM integrations (HubSpot & more)",
  "Knowledge base & scheduling",
  "SMS & email follow-up",
  "Priority support",
];

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";
  const [annual, setAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState(canceled ? "Checkout was cancelled. You can try again when you're ready." : "");

  async function handleCheckout(slug: string) {
    setLoadingPlan(slug);
    setError("");
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
        window.location.replace(data.url);
      } else {
        setError(data.error || "Failed to start checkout. Please try again.");
        setLoadingPlan(null);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoadingPlan(null);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0c4a6e]" />
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-16">
        {/* Success state */}
        {success && (
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-6">
              <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">Subscription Confirmed!</h1>
            <p className="text-white/60 mb-2">
              Check your email for an invite link to set up your account.
            </p>
            <p className="text-white/40 text-sm">
              The link will expire in 24 hours. If you don&apos;t see it, check your spam folder.
            </p>
          </div>
        )}

        {!success && <>
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Get Started with Invaria Labs</h1>
          <p className="text-white/60 max-w-md mx-auto">
            Choose a plan to create your account. You&apos;ll be set up in minutes.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1 mb-8">
          <button
            onClick={() => setAnnual(false)}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-medium transition-all",
              !annual ? "bg-white text-gray-900" : "text-white/60 hover:text-white"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
              annual ? "bg-white text-gray-900" : "text-white/60 hover:text-white"
            )}
          >
            Annual
            <span className="text-[10px] bg-emerald-400 text-gray-900 px-2 py-0.5 rounded-full font-bold">-20%</span>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm max-w-lg text-center">
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 gap-5 w-full max-w-2xl mb-10">
          {plans.map((plan) => (
            <div
              key={plan.slug}
              className={cn(
                "backdrop-blur-xl rounded-2xl border p-6 transition-all",
                plan.highlighted
                  ? "bg-white/15 border-white/30 shadow-2xl ring-1 ring-white/20"
                  : "bg-white/10 border-white/20"
              )}
            >
              {plan.highlighted && (
                <div className="inline-block bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full mb-4">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
              <p className="text-sm text-white/50 mb-4">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-4xl font-bold text-white">
                  ${annual ? plan.annualPrice : plan.monthlyPrice}
                </span>
                <span className="text-white/40 text-sm">/mo</span>
              </div>
              {annual && (
                <p className="text-xs text-white/40 -mt-3 mb-5">Billed annually</p>
              )}

              <div className="space-y-2.5 mb-6">
                {plan.highlights.map((h) => (
                  <div key={h} className="flex items-center gap-2.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-sm text-white/70">{h}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleCheckout(plan.slug)}
                disabled={!!loadingPlan}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all disabled:opacity-70",
                  plan.highlighted
                    ? "bg-white text-gray-900 hover:bg-gray-100"
                    : "bg-white/10 text-white border border-white/20 hover:bg-white/20"
                )}
              >
                {loadingPlan === plan.slug ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Get Started <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Included features */}
        <div className="text-center mb-8">
          <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-4">Included in every plan</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {includedFeatures.map((f) => (
              <div key={f} className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-400/60" />
                <span className="text-xs text-white/40">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Enterprise + Login link */}
        <div className="text-center space-y-3">
          <p className="text-white/40 text-sm">
            Need a custom plan?{" "}
            <Link href="/contact" className="text-blue-400 hover:text-blue-300 transition-colors">
              Contact Sales
            </Link>
          </p>
          <p className="text-white/40 text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
              Log In
            </Link>
          </p>
        </div>
        </>}
      </div>
    </div>
  );
}
