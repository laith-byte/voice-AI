"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Phone,
  MessageSquare,
  Calendar,
  BarChart3,
  Globe,
  Link2,
} from "lucide-react";

const features = [
  {
    icon: Phone,
    title: "24/7 Inbound & Outbound",
    description: "Your AI agents answer every call instantly, day or night. No hold music, no missed opportunities.",
  },
  {
    icon: MessageSquare,
    title: "Human-Like Conversations",
    description: "Powered by the latest LLMs with context-aware responses, proper pacing, and emotional intelligence.",
  },
  {
    icon: Calendar,
    title: "Appointment Scheduling",
    description: "Books directly into Google Calendar, Calendly, or your CRM. Handles rescheduling and sends confirmations.",
  },
  {
    icon: Link2,
    title: "CRM Integration",
    description: "Every call logged, every lead captured. Syncs with HubSpot and more CRMs via Zapier.",
  },
  {
    icon: BarChart3,
    title: "Post-Call Analytics",
    description: "Full transcripts, sentiment analysis, call outcomes, and performance dashboards.",
  },
  {
    icon: Globe,
    title: "Multi-Language Support",
    description: "Handle calls in Spanish, French, Mandarin, and 30+ languages without hiring multilingual staff.",
  },
];

export function FeaturesShowcase() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-24 lg:py-32 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 mb-4 tracking-tight">
            Everything Your Team Needs
          </h2>
          <p className="text-base text-gray-500 max-w-2xl mx-auto">
            A complete voice AI platform with every capability your business requires.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="group rounded-xl border border-gray-100 bg-white p-7 transition-all duration-300 hover:border-gray-200 hover:shadow-lg"
              >
                <div className="w-10 h-10 rounded-lg bg-navy-950 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-navy-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
