import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Invaria Labs",
  description: "Invaria Labs privacy policy — how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-navy-950">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
        <h1 className="font-display text-4xl font-bold text-white mb-4">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-12">Effective Date: February 22, 2026</p>

        <div className="prose prose-invert prose-gray max-w-none space-y-8 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              Invaria Labs (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the Invaria Labs Voice AI
              Platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when
              you use our platform, website, and related services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
            <p>We may collect the following types of information:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong className="text-white">Account Information:</strong> Name, email address, company name, phone number, and billing details when you create an account or subscribe to our services.</li>
              <li><strong className="text-white">Usage Data:</strong> Information about how you interact with our platform, including call logs, agent configurations, and feature usage.</li>
              <li><strong className="text-white">Call Data:</strong> Voice call recordings, transcriptions, and metadata processed through our AI agents, subject to your configuration and consent settings.</li>
              <li><strong className="text-white">Technical Data:</strong> IP address, browser type, device information, and cookies used to improve our services.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide, maintain, and improve our Voice AI platform and services.</li>
              <li>To process transactions and send related billing information.</li>
              <li>To communicate with you about updates, security alerts, and support.</li>
              <li>To analyze usage patterns and optimize platform performance.</li>
              <li>To comply with legal obligations and enforce our terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Sharing</h2>
            <p>
              We do not sell your personal information. We may share data with trusted third-party service providers
              (such as cloud hosting, payment processing, and telephony providers) solely to operate our platform.
              All third parties are contractually required to protect your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Security</h2>
            <p>
              We implement industry-standard security measures including encryption at rest (AES-256-GCM),
              encryption in transit (TLS), role-based access controls, and regular security audits to protect
              your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide services. You may
              request deletion of your data at any time by contacting us. We will delete or anonymize your data
              within 30 days of a verified request, unless retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Access, correct, or delete your personal data.</li>
              <li>Object to or restrict certain processing activities.</li>
              <li>Request data portability.</li>
              <li>Withdraw consent where processing is based on consent.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or wish to exercise your data rights, contact us
              at{" "}
              <a href="mailto:sales@invarialabs.com" className="text-blue-400 hover:text-blue-300 transition-colors">
                sales@invarialabs.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
