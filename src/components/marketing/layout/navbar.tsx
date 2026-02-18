"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const industries = [
  { name: "Healthcare & Dental", slug: "healthcare" },
  { name: "Legal Services", slug: "legal" },
  { name: "Home Services", slug: "home-services" },
  { name: "Real Estate", slug: "real-estate" },
  { name: "Insurance", slug: "insurance" },
  { name: "Financial Services", slug: "financial-services" },
  { name: "Automotive", slug: "automotive" },
  { name: "Hospitality & Restaurants", slug: "hospitality" },
];

const navLinks = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileIndustriesOpen, setMobileIndustriesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white",
          scrolled && "shadow-sm border-b border-gray-100"
        )}
      >
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between lg:h-[72px]">
            <Link href="/" className="flex items-center gap-1">
              <span className="font-display text-xl font-bold text-navy-900">Invaria</span>
              <span className="font-display text-xl font-bold text-navy-400">Labs</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden items-center gap-1 lg:flex">
              <div ref={dropdownRef} className="relative"
                onMouseEnter={() => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setDropdownOpen(true); }}
                onMouseLeave={() => { timeoutRef.current = setTimeout(() => setDropdownOpen(false), 150); }}
              >
                <button onClick={() => setDropdownOpen(!dropdownOpen)}
                  className={cn("flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors", dropdownOpen ? "text-navy-900" : "text-gray-600 hover:text-navy-900")}
                >
                  Industries
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", dropdownOpen && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }} transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute left-0 top-full mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                    >
                      {industries.map((ind) => (
                        <Link key={ind.slug} href={`/industries/${ind.slug}`} onClick={() => setDropdownOpen(false)}
                          className="block px-4 py-2 text-[13px] text-gray-600 transition-colors hover:bg-gray-50 hover:text-navy-900"
                        >{ind.name}</Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-navy-900">{link.label}</Link>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <Link href="/contact" className="hidden lg:inline-flex items-center gap-2 rounded-lg bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-navy-800">Book a Demo</Link>
              <Link href="/login" className="hidden lg:inline-flex items-center text-sm font-medium text-gray-600 hover:text-navy-900 transition-colors">Log In</Link>
              <Link href="/login" className="hidden lg:inline-flex items-center gap-2 rounded-lg border border-navy-900/20 px-4 py-2 text-sm font-semibold text-navy-900 transition-all duration-200 hover:bg-navy-900 hover:text-white">Sign Up</Link>
              <button onClick={() => setMobileOpen(!mobileOpen)} className="relative z-50 rounded-lg p-2 text-gray-600 transition-colors hover:text-navy-900 lg:hidden" aria-label={mobileOpen ? "Close menu" : "Open menu"}>
                {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </nav>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 z-40 flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-gray-200 bg-white lg:hidden"
            >
              <div className="h-16 shrink-0" />
              <div className="flex flex-1 flex-col gap-1 px-6 py-6">
                <div>
                  <button onClick={() => setMobileIndustriesOpen(!mobileIndustriesOpen)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Industries
                    <ChevronDown className={cn("h-5 w-5 text-gray-400 transition-transform duration-200", mobileIndustriesOpen && "rotate-180")} />
                  </button>
                  <AnimatePresence>
                    {mobileIndustriesOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="flex flex-col gap-0.5 pb-2 pl-4">
                          {industries.map((ind) => (
                            <Link key={ind.slug} href={`/industries/${ind.slug}`} onClick={() => setMobileOpen(false)}
                              className="rounded-lg px-3 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-navy-900"
                            >{ind.name}</Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-3 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >{link.label}</Link>
                ))}
                <div className="my-4 h-px bg-gray-100" />
                <Link href="/contact" onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-5 py-3 text-base font-semibold text-white"
                >Book a Demo</Link>
                <div className="my-2 h-px bg-gray-100" />
                <Link href="/login" onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-navy-900/20 px-5 py-3 text-base font-semibold text-navy-900"
                >Log In / Sign Up</Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
