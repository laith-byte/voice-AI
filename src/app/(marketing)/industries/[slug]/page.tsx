import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CTASection } from "@/components/marketing/sections/cta-section";
import { industries, getIndustryBySlug } from "@/lib/marketing/industries";
import { CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";

export function generateStaticParams() {
  return industries.map((ind) => ({ slug: ind.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const industry = getIndustryBySlug(slug);
  if (!industry) return { title: "Industry Not Found" };
  return {
    title: `${industry.name} AI Voice Agents | Invaria Labs`,
    description: industry.description,
  };
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const industry = getIndustryBySlug(slug);
  if (!industry) notFound();

  return (
    <main>
      {/* Hero */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-navy-900 to-navy-950 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[600px] h-[600px] rounded-full bg-gold-400/5 blur-[120px] -top-40 -right-40" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <Link href="/industries" className="inline-flex items-center gap-1 text-sm text-gold-400 hover:text-gold-300 mb-6 transition-colors">
              &larr; All Industries
            </Link>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white mb-6">
              {industry.name}
            </h1>
            <p className="text-xl text-gray-300 leading-relaxed mb-8">{industry.description}</p>
            <div className="flex flex-wrap gap-4">
              {industry.metrics.map((m) => (
                <div key={m.label} className="bg-white/5 border border-white/10 rounded-xl px-5 py-3">
                  <p className="text-2xl font-bold text-gold-400">{m.value}</p>
                  <p className="text-sm text-gray-400">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl sm:text-4xl text-navy-900 mb-12">
            Challenges {industry.name} Businesses Face
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {industry.painPoints.map((point, i) => (
              <div key={i} className="flex gap-4 p-6 rounded-xl border border-gray-100 bg-gray-50/50">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-gray-600 leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agent Templates */}
      <section className="py-20 bg-gray-50/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl sm:text-4xl text-navy-900 mb-4">
            {industry.agents.length} Specialized Agent Templates
          </h2>
          <p className="text-lg text-gray-500 mb-12 max-w-2xl">
            Each agent is pre-configured with industry-specific workflows, prompts, and integrations. Customize and go live in minutes.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {industry.agents.map((agent) => (
              <div key={agent.name} className="rounded-2xl border border-gray-100 bg-white p-8">
                <h3 className="text-lg font-semibold text-navy-900 mb-3">{agent.name}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">{agent.description}</p>
                <ul className="space-y-2">
                  {agent.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="py-20 bg-navy-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl sm:text-4xl text-white mb-12">Results That Matter</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {industry.metrics.map((m) => (
              <div key={m.label} className="p-8">
                <TrendingUp className="w-8 h-8 text-gold-400 mx-auto mb-4" />
                <p className="text-4xl font-bold text-white mb-2">{m.value}</p>
                <p className="text-gray-400">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        heading={`Deploy ${industry.name} AI Agents Today`}
        subheading="Start with a pre-built template and go live in minutes. Or book a demo and our team will build it for you."
        primaryCta={{ label: "Book a Demo", href: "/contact" }}
        secondaryCta={{ label: "View Pricing", href: "/pricing" }}
        variant="light"
      />
    </main>
  );
}
