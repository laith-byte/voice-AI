import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Invaria Labs",
  description: "Invaria Labs terms of service — the agreement governing use of our Voice AI platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-navy-950">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
        <h1 className="font-display text-4xl font-bold text-white mb-4">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-12">Effective Date: February 22, 2026</p>

        <div className="prose prose-invert prose-gray max-w-none space-y-8 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Invaria Labs Voice AI Platform (&quot;Platform&quot;), you agree to be bound
              by these Terms of Service (&quot;Terms&quot;). If you are using the Platform on behalf of an organization,
              you represent that you have authority to bind that organization to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              Invaria Labs provides an AI-powered voice, chat, and SMS agent platform that enables businesses to
              automate customer communications. The Platform includes agent configuration, call handling, analytics,
              integrations, and related tools.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Account Registration</h2>
            <p>
              You must provide accurate and complete information when creating an account. You are responsible for
              maintaining the security of your account credentials and for all activities that occur under your
              account. Notify us immediately of any unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Use the Platform for any unlawful purpose or in violation of applicable regulations.</li>
              <li>Transmit harmful, abusive, or fraudulent content through AI agents.</li>
              <li>Attempt to gain unauthorized access to the Platform or its infrastructure.</li>
              <li>Interfere with or disrupt the Platform&apos;s operation or other users&apos; access.</li>
              <li>Use the Platform to make robocalls or engage in telemarketing without proper consent.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Billing and Payment</h2>
            <p>
              Paid plans are billed on a recurring basis (monthly or annually) as selected at checkout. All fees
              are non-refundable except as required by law. We reserve the right to modify pricing with 30 days
              written notice. Usage-based charges (calls, messages, AI processing) are billed in arrears.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Intellectual Property</h2>
            <p>
              The Platform, including its design, code, features, and documentation, is owned by Invaria Labs and
              protected by intellectual property laws. You retain ownership of your data and content. By using the
              Platform, you grant us a limited license to process your data solely to provide the services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Data and Privacy</h2>
            <p>
              Your use of the Platform is also governed by our{" "}
              <Link href="/privacy" className="text-blue-400 hover:text-blue-300 transition-colors">
                Privacy Policy
              </Link>
              . You are responsible for ensuring that your use of AI agents complies with applicable data
              protection and privacy laws, including obtaining necessary consents for call recording and data
              processing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted service. We may perform
              maintenance, updates, or modifications that temporarily affect availability. We are not liable for
              downtime caused by factors outside our reasonable control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Invaria Labs shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages arising from your use of the Platform. Our total liability
              shall not exceed the amount you paid us in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Termination</h2>
            <p>
              Either party may terminate the agreement at any time. We may suspend or terminate your access if you
              violate these Terms. Upon termination, your right to use the Platform ceases. We will make your data
              available for export for 30 days following termination.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes via email or
              through the Platform. Continued use after changes take effect constitutes acceptance of the updated
              Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Contact Us</h2>
            <p>
              For questions about these Terms, contact us at{" "}
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
