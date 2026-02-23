import { Metadata } from "next";
import PricingContent from "./_pricing-content";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for Invaria Labs voice AI agents. Starter plan at $499/month.",
};

export default function PricingPage() {
  return <PricingContent />;
}
