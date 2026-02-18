import { Metadata } from "next";
import { CTASection } from "@/components/marketing/sections/cta-section";
import { LayoutTemplate, Users, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "About | Invaria Labs",
  description: "We built Invaria Labs because every business deserves an AI team that never misses a call. Learn our story.",
};

const pillars = [
  {
    icon: LayoutTemplate,
    title: "Industry-First",
    description: "Our agent templates are built from real business workflows, not generic chatbot scripts. Every template reflects how calls actually happen in your industry — the questions callers ask, the data you need to collect, and the outcomes that matter.",
  },
  {
    icon: Users,
    title: "White-Glove Optional",
    description: "Self-serve platform for teams that want to move fast. Custom deployment services for companies that want hands-on buildout. You choose the level of support that fits — and you can change your mind anytime.",
  },
  {
    icon: Sparkles,
    title: "Always Improving",
    description: "We continuously upgrade our language models, add new integrations, and expand industry templates. Your agents get smarter over time without any action required from you.",
  },
];

const team = [
  { name: "Alex Rivera", role: "CEO & Co-Founder", bio: "Previously led product at a top SaaS company. Passionate about making enterprise AI accessible to every business." },
  { name: "Jordan Patel", role: "CTO & Co-Founder", bio: "Machine learning engineer with a decade of experience in speech recognition and natural language processing." },
  { name: "Sam Nakamura", role: "Head of Customer Success", bio: "Former operations director who understands the real-world challenges of managing business phone systems." },
];

export default function AboutPage() {
  return (
    <main>
      {/* Hero */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-navy-900 to-navy-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-display text-5xl sm:text-6xl text-white mb-6">
            We Believe Every Business Deserves an AI Team
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Invaria Labs exists to give small and medium businesses the same phone capabilities that Fortune 500 companies have — at a fraction of the cost.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl sm:text-4xl text-navy-900 mb-8">
            Why We Built This
          </h2>
          <div className="prose prose-lg text-gray-600 space-y-6">
            <p>
              Every day, thousands of businesses lose revenue because of missed calls. A dental patient calls to book a cleaning and gets voicemail. A homeowner with a burst pipe reaches an answering service that can&apos;t dispatch anyone. A potential legal client calls three firms and goes with the one that actually picks up.
            </p>
            <p>
              The problem isn&apos;t that these businesses don&apos;t care about their customers. It&apos;s that they&apos;re understaffed, overwhelmed, and stuck choosing between hiring expensive receptionists or missing calls.
            </p>
            <p>
              We built Invaria Labs to eliminate that tradeoff. Our AI voice agents answer every call instantly, 24/7, with the knowledge and professionalism your business demands. They book appointments, qualify leads, handle emergencies, and follow up — all without putting anyone on hold.
            </p>
            <p>
              And because every industry has unique workflows, we built 32 specialized agent templates across 8 verticals. Not generic chatbots. Real, purpose-built phone agents that understand how your business works.
            </p>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="py-20 bg-gray-50/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl sm:text-4xl text-navy-900 text-center mb-12">
            Our Approach
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-navy-900 flex items-center justify-center mx-auto mb-5">
                    <Icon className="w-7 h-7 text-gold-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-3">{p.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{p.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Technology */}
      <section className="py-20 bg-navy-900">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl sm:text-4xl text-white mb-6">
            Built on the Latest AI
          </h2>
          <p className="text-lg text-gray-400 leading-relaxed">
            Our platform leverages the most advanced large language models for understanding and generating natural speech, combined with real-time audio processing for sub-second response times. The result is phone conversations that feel genuinely human — with the consistency, availability, and scalability that only AI can deliver.
          </p>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl sm:text-4xl text-navy-900 text-center mb-4">
            The Team
          </h2>
          <p className="text-sm text-gray-400 text-center italic mb-12">
            * Placeholder team members for demonstration purposes
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {team.map((member) => (
              <div key={member.name} className="text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-navy-200 to-navy-300 mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl font-display text-navy-700">{member.name.split(" ").map(n => n[0]).join("")}</span>
                </div>
                <h3 className="font-semibold text-navy-900">{member.name}</h3>
                <p className="text-sm text-gold-600 mb-2">{member.role}</p>
                <p className="text-sm text-gray-500">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        heading="Ready to Transform Your Phone Operations?"
        subheading="Book a demo and see how Invaria Labs can work for your business."
        primaryCta={{ label: "Book a Demo", href: "/contact" }}
        variant="dark"
      />
    </main>
  );
}
