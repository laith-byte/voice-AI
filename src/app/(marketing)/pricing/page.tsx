import { Metadata } from "next";
import PricingContent from "./_pricing-content";

export const metadata: Metadata = {
  title: "Pricing",
};

export default function PricingPage() {
  return <PricingContent />;
}
