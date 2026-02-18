import { Metadata } from "next";
import Link from "next/link";
import { CTASection } from "@/components/marketing/sections/cta-section";
import { industries } from "@/lib/marketing/industries";
import { Stethoscope, Scale, Wrench, Building2, Shield, Landmark, Car, UtensilsCrossed } from "lucide-react";

export const metadata: Metadata = {
  title: "Industries | Invaria Labs",
  description: "AI voice agents purpose-built for healthcare, legal, home services, real estate, insurance, financial services, automotive, and hospitality.",
};

const iconMap: Record<string, React.ElementType> = {
  Stethoscope, Scale, Wrench, Building2, Shield, Landmark, Car, UtensilsCrossed,
};

export default function IndustriesPage() {
  return (
    <main>
      <section className="pt-32 pb-20 bg-gradient-to-b from-navy-900 to-navy-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
            AI Voice Agents for Every Industry
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            8 industry verticals. 32 specialized agent templates. Each one designed from real business workflows.
          </p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {industries.map((ind) => {
              const Icon = iconMap[ind.icon] || Stethoscope;
              return (
                <Link
                  key={ind.slug}
                  href={`/industries/${ind.slug}`}
                  className="group block rounded-2xl border border-gray-100 bg-white p-6 transition-all hover:border-gold-300 hover:shadow-lg hover:shadow-gold-400/10"
                >
                  <div className="w-12 h-12 rounded-xl bg-navy-900/5 flex items-center justify-center mb-4 group-hover:bg-gold-400/10 transition-colors">
                    <Icon className="w-6 h-6 text-navy-700 group-hover:text-gold-600 transition-colors" />
                  </div>
                  <h3 className="font-semibold text-navy-900 mb-2">{ind.name}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">{ind.description.slice(0, 100)}...</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-medium text-gold-600 bg-gold-50 px-2.5 py-1 rounded-full">{ind.agents.length} agents</span>
                    {ind.metrics.slice(0, 1).map((m) => (
                      <span key={m.label} className="text-xs font-medium text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">{m.value} {m.label}</span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <CTASection
        heading="Not Sure Which Industry Fits?"
        subheading="Book a call with our team and we'll help you find the right agent template for your business."
        primaryCta={{ label: "Book a Demo", href: "/contact" }}
        variant="dark"
      />
    </main>
  );
}
