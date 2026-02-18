"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CTAProps {
  heading: string;
  subheading: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  variant: "dark" | "light";
}

export function CTASection({ heading, subheading, primaryCta, secondaryCta, variant }: CTAProps) {
  const isDark = variant === "dark";

  return (
    <section className={cn("py-24 lg:py-32 relative overflow-hidden", isDark ? "bg-navy-950" : "bg-white")}>
      {isDark && (
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />
      )}
      <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className={cn("font-display text-3xl sm:text-4xl font-bold mb-6 tracking-tight", isDark ? "text-white" : "text-navy-900")}>
          {heading}
        </h2>
        <p className={cn("text-base mb-10 max-w-xl mx-auto", isDark ? "text-gray-400" : "text-gray-500")}>
          {subheading}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={primaryCta.href}
            className={cn(
              "inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg text-sm font-semibold transition-all duration-200",
              isDark
                ? "bg-white text-navy-950 hover:bg-gray-100"
                : "bg-navy-900 text-white hover:bg-navy-800"
            )}
          >
            {primaryCta.label}
            <ArrowRight className="w-4 h-4" />
          </Link>
          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              className={cn(
                "inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg text-sm font-semibold transition-all duration-200",
                isDark
                  ? "border border-white/20 text-white hover:bg-white/5"
                  : "border border-gray-200 text-navy-900 hover:border-gray-300"
              )}
            >
              {secondaryCta.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
