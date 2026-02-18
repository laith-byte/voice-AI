import { Hero } from "@/components/marketing/sections/hero";
import { Comparison } from "@/components/marketing/sections/comparison";
import { LiveDemo } from "@/components/marketing/sections/live-demo";
import { WhiteGlove } from "@/components/marketing/sections/white-glove";
import { Highlights } from "@/components/marketing/sections/highlights";
import { Omnichannel, TelephonyStack, EnterpriseSecurity, Integrations } from "@/components/marketing/sections/platform-features";
import { IndustriesGrid } from "@/components/marketing/sections/industries-grid";
import { FAQSection } from "@/components/marketing/sections/faq-section";
import { CTASection } from "@/components/marketing/sections/cta-section";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Comparison />
      <IndustriesGrid />
      <WhiteGlove />
      <LiveDemo />
      <Highlights />
      <Omnichannel />
      <TelephonyStack />
      <EnterpriseSecurity />
      <Integrations />
      <FAQSection />
      <CTASection
        heading="Revolutionize Your Call Operations with Invaria"
        subheading="Start building smarter conversations today."
        primaryCta={{ label: "Book a Demo", href: "/contact" }}
        secondaryCta={{ label: "View Pricing", href: "/pricing" }}
        variant="dark"
      />
    </main>
  );
}
