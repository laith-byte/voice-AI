import { Metadata } from "next";
import ContactContent from "./_contact-content";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with Invaria Labs. Schedule a demo, ask questions, or learn how voice AI can transform your business.",
};

export default function ContactPage() {
  return <ContactContent />;
}
