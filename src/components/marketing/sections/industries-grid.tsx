"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, Stethoscope, Scale, Wrench, Building2, Shield, Landmark, Car, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

const industries = [
  { name: "Healthcare & Dental", slug: "healthcare", icon: Stethoscope, description: "AI receptionists, appointment reminders, patient triage.", templates: 4, gradient: "from-teal-400 to-teal-500", bg: "bg-teal-50", text: "text-teal-600" },
  { name: "Legal Services", slug: "legal", icon: Scale, description: "Client intake, case screening, status updates.", templates: 4, gradient: "from-indigo-400 to-indigo-500", bg: "bg-indigo-50", text: "text-indigo-600" },
  { name: "Home Services", slug: "home-services", icon: Wrench, description: "Service dispatch, emergency triage, estimate follow-ups.", templates: 4, gradient: "from-orange-400 to-orange-500", bg: "bg-orange-50", text: "text-orange-600" },
  { name: "Real Estate", slug: "real-estate", icon: Building2, description: "Lead qualification, showing scheduling, open house follow-up.", templates: 4, gradient: "from-blue-400 to-blue-500", bg: "bg-blue-50", text: "text-blue-600" },
  { name: "Insurance", slug: "insurance", icon: Shield, description: "Quote intake, policy renewals, claims processing.", templates: 4, gradient: "from-emerald-400 to-emerald-500", bg: "bg-emerald-50", text: "text-emerald-600" },
  { name: "Financial Services", slug: "financial-services", icon: Landmark, description: "Appointment booking, payment reminders, referral generation.", templates: 4, gradient: "from-purple-400 to-purple-500", bg: "bg-purple-50", text: "text-purple-600" },
  { name: "Automotive", slug: "automotive", icon: Car, description: "Service scheduling, sales lead qualification, test drive booking.", templates: 4, gradient: "from-red-400 to-red-500", bg: "bg-red-50", text: "text-red-600" },
  { name: "Hospitality", slug: "hospitality", icon: UtensilsCrossed, description: "Reservations, catering inquiries, concierge services.", templates: 4, gradient: "from-gold-300 to-gold-400", bg: "bg-amber-50", text: "text-amber-600" },
];

export function IndustriesGrid() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-24 lg:py-32 bg-gray-50 relative overflow-hidden">
      <div className="absolute w-[500px] h-[500px] top-[-10%] right-[-15%] rounded-full bg-gradient-to-bl from-teal-200/15 to-navy-200/5 blur-[120px]" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 mb-4 tracking-tight">
            Purpose-Built for Your Industry
          </h2>
          <p className="text-base text-gray-500 max-w-2xl mx-auto">
            8 industry verticals. 32 agent templates. Each one designed from real business workflows.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {industries.map((ind, i) => {
            const Icon = ind.icon;
            return (
              <motion.div
                key={ind.slug}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.06, duration: 0.5 }}
              >
                <Link
                  href={`/industries/${ind.slug}`}
                  className="group block h-full rounded-xl border border-gray-200 bg-white p-6 transition-all duration-300 hover:border-gray-300 hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-1"
                >
                  <div className={cn("w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110", ind.gradient)}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-navy-900 mb-1.5 text-sm">{ind.name}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4">{ind.description}</p>
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", ind.bg, ind.text)}>
                      {ind.templates} templates
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 transition-all duration-300 group-hover:text-navy-900 group-hover:translate-x-1" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
