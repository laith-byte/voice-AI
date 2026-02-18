"use client";

import { useState } from "react";
import { Mail, Phone, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const industryOptions = [
  "Healthcare & Dental",
  "Legal Services",
  "Home Services",
  "Real Estate",
  "Insurance",
  "Financial Services",
  "Automotive",
  "Hospitality & Restaurants",
  "Other",
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    industry: "",
    message: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        throw new Error("Failed to send message");
      }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main>
      <section className="pt-32 pb-20 bg-gradient-to-b from-navy-900 to-navy-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
              Let&apos;s Talk
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Book a demo, ask a question, or tell us about your business. Our team responds within 24 hours.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white -mt-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12 lg:gap-16">
            {/* Form */}
            <div className="lg:col-span-3">
              {submitted ? (
                <div className="text-center py-20">
                  <CheckCircle2 className="w-16 h-16 text-teal-500 mx-auto mb-6" />
                  <h2 className="text-2xl font-semibold text-navy-900 mb-3">Thank You!</h2>
                  <p className="text-gray-500 max-w-md mx-auto">
                    We&apos;ve received your message and will get back to you within 24 hours. In the meantime, feel free to explore our industry templates.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-navy-900 mb-2">Name *</label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-navy-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400"
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-navy-900 mb-2">Email *</label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-navy-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400"
                        placeholder="you@company.com"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-navy-900 mb-2">Company *</label>
                      <input
                        type="text"
                        required
                        value={form.company}
                        onChange={(e) => setForm({ ...form, company: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-navy-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400"
                        placeholder="Your company name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-navy-900 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-navy-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy-900 mb-2">Industry *</label>
                    <select
                      required
                      value={form.industry}
                      onChange={(e) => setForm({ ...form, industry: e.target.value })}
                      className={cn(
                        "w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400 bg-white",
                        !form.industry && "text-gray-400"
                      )}
                    >
                      <option value="" disabled>Select your industry</option>
                      {industryOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-navy-900 mb-2">Message</label>
                    <textarea
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-navy-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400 resize-none"
                      placeholder="Tell us about your business and what you're looking for..."
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-lg bg-gradient-to-r from-gold-400 to-gold-500 text-navy-950 font-semibold shadow-lg shadow-gold-400/20 hover:from-gold-300 hover:to-gold-400 transition-all disabled:opacity-70"
                  >
                    {isLoading ? "Sending..." : "Send Message"}
                  </button>
                </form>
              )}
            </div>

            {/* Right side info */}
            <div className="lg:col-span-2 space-y-8">
              {/* Book a Demo */}
              <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-8">
                <h3 className="text-lg font-semibold text-navy-900 mb-3">Book a Demo</h3>
                <p className="text-sm text-gray-500 mb-6">
                  See your industry template handle real calls in a 15-minute personalized demo.
                </p>
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
                  <p className="text-sm text-gray-400">Calendar booking widget</p>
                  <p className="text-xs text-gray-300 mt-1">Calendly integration coming soon</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-navy-900/5 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-navy-700" />
                  </div>
                  <div>
                    <p className="font-medium text-navy-900 text-sm">Email</p>
                    <p className="text-sm text-gray-500">hello@invarialabs.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-navy-900/5 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-navy-700" />
                  </div>
                  <div>
                    <p className="font-medium text-navy-900 text-sm">Phone</p>
                    <p className="text-sm text-gray-500">(888) 555-0199</p>
                    <p className="text-xs text-gray-400">Placeholder number</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-navy-900/5 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-navy-700" />
                  </div>
                  <div>
                    <p className="font-medium text-navy-900 text-sm">Office Hours</p>
                    <p className="text-sm text-gray-500">Mon — Fri, 9 AM — 6 PM EST</p>
                  </div>
                </div>
              </div>

              {/* Prefer to talk */}
              <div className="rounded-2xl bg-navy-900 p-8 text-center">
                <h3 className="text-lg font-semibold text-white mb-2">Prefer to Talk?</h3>
                <p className="text-sm text-gray-400 mb-4">Call us directly during business hours. We love hearing from potential customers.</p>
                <a href="tel:+18885550199" className="inline-flex items-center gap-2 text-gold-400 font-semibold text-sm hover:text-gold-300 transition-colors">
                  <Phone className="w-4 h-4" />
                  (888) 555-0199
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
