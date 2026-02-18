"use client";

import { useState, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "What is an AI voice agent?",
    answer: "An AI voice agent is an autonomous system that uses speech recognition, large language models, and text-to-speech to conduct natural phone conversations. Unlike traditional IVRs or chatbots, AI voice agents understand context, handle unexpected inputs, and can take real actions like booking appointments or updating your CRM — all in real time.",
  },
  {
    question: "How do Invaria Labs voice agents work?",
    answer: "Our agents use proprietary voice AI orchestration with sub-600ms latency for natural, real-time conversations. When a call comes in, the agent processes speech, understands intent through LLMs, takes actions via real-time function calling (booking, CRM updates, transfers), and responds with ultra-realistic voice — all in milliseconds.",
  },
  {
    question: "How do I create an AI voice agent with Invaria?",
    answer: "Choose from 32 pre-built industry templates, customize the agent's prompts and knowledge base, connect your calendar and CRM, and assign a phone number. The entire setup takes minutes. You can test with our built-in simulation before going live.",
  },
  {
    question: "Can I connect agents to my existing phone number?",
    answer: "Yes. You can connect your existing phone numbers via SIP trunking or port them directly. No infrastructure changes needed — your agents work with your current phone system.",
  },
  {
    question: "What industries do you support?",
    answer: "We have purpose-built templates for healthcare & dental, legal services, home services, real estate, insurance, financial services, automotive, and hospitality. Each vertical comes with 4 specialized agent templates based on real business workflows.",
  },
];

export function FAQSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-24 lg:py-32 bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight">
            Common Questions
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="space-y-3"
        >
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <span className="font-medium text-navy-900 text-sm">{faq.question}</span>
                <ChevronDown className={cn("w-5 h-5 text-gray-400 transition-transform shrink-0 ml-4", openFaq === i && "rotate-180")} />
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
  );
}
