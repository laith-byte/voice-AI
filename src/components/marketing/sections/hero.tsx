"use client";

import { motion } from "framer-motion";
import { Phone } from "lucide-react";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative pt-[72px]">
      <div className="mx-3 sm:mx-4 lg:mx-6">
        <div className="relative overflow-hidden rounded-2xl lg:rounded-3xl min-h-[85vh] flex flex-col">
          <div className="absolute inset-0 animate-gradient" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 20%, #4338ca 40%, #4f46e5 55%, #6366f1 70%, #3730a3 85%, #1e1b4b 100%)", backgroundSize: "300% 300%" }} />
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute w-[70%] h-[70%] top-[-15%] right-[-15%] rounded-full bg-gradient-to-br from-indigo-500/50 to-violet-500/30 blur-[100px] animate-blob" />
            <div className="absolute w-[55%] h-[55%] bottom-[-15%] left-[-15%] rounded-full bg-gradient-to-tr from-indigo-900/70 to-blue-600/40 blur-[100px] animate-blob-reverse" />
            <div className="absolute w-[45%] h-[45%] top-[25%] left-[25%] rounded-full bg-gradient-to-r from-violet-400/20 to-indigo-400/20 blur-[80px] animate-blob-slow" />
            <div className="absolute w-[35%] h-[35%] top-[10%] left-[60%] rounded-full bg-gradient-to-bl from-blue-400/25 to-purple-500/15 blur-[70px] animate-blob" style={{ animationDelay: "-4s" }} />
            <div className="absolute w-[30%] h-[30%] bottom-[10%] right-[20%] rounded-full bg-gradient-to-tl from-indigo-300/15 to-violet-600/10 blur-[60px] animate-blob-slow" style={{ animationDelay: "-8s" }} />
          </div>
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
          <div className="relative z-10 flex-1 flex flex-col px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }} className="text-center text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-white/70 mb-6 lg:mb-8">
              #1 AI Voice Agent Platform for Automating Calls
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }} className="text-center font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-white leading-[1.05] tracking-tight max-w-5xl mx-auto flex-1 flex items-center">
              <span>Meet your AI call center<br />from the future.</span>
            </motion.h1>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }} className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 mt-auto">
              <div className="max-w-md">
                <p className="text-sm sm:text-base text-white/80 leading-relaxed">Build, deploy, and manage next-generation AI voice agents that sound human, execute tasks, and scale effortlessly.</p>
              </div>
              <Link href="#live-demo" className="group flex items-center gap-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 pl-5 pr-3 py-3 transition-all duration-300 hover:bg-white/20 hover:border-white/30 shrink-0">
                <span className="text-white font-semibold text-sm">Try Our Live Demo</span>
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white/30 to-white/10 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-white" />
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
