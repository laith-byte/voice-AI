import { Metadata } from "next";
import FeaturesContent from "./_features-content";

export const metadata: Metadata = {
  title: "Features",
  description: "Explore the full suite of Invaria Labs voice AI features — from intelligent call routing to real-time analytics and seamless CRM integrations.",
};

export default function FeaturesPage() {
  return <FeaturesContent />;
}
