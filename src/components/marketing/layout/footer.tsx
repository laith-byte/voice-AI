import Link from "next/link";

const platformLinks = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Industries", href: "/industries" },
];

const industryLinks = [
  { label: "Healthcare & Dental", href: "/industries/healthcare" },
  { label: "Legal Services", href: "/industries/legal" },
  { label: "Home Services", href: "/industries/home-services" },
  { label: "Real Estate", href: "/industries/real-estate" },
  { label: "Insurance", href: "/industries/insurance" },
  { label: "Financial Services", href: "/industries/financial-services" },
  { label: "Automotive", href: "/industries/automotive" },
  { label: "Hospitality", href: "/industries/hospitality" },
];

const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Log In", href: "/login" },
];

export function Footer() {
  return (
    <footer className="bg-navy-950 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-1 mb-4">
              <span className="font-display text-xl font-bold text-white">Invaria</span>
              <span className="font-display text-xl font-bold text-navy-400">Labs</span>
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
              AI voice agents, purpose-built for your industry. Deploy in minutes. Never miss another call.
            </p>
            <div className="mt-6 flex gap-4">
              <span className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 text-xs">Li</span>
              <span className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 text-xs">X</span>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold text-gold-400 uppercase tracking-wider mb-4">Platform</h4>
            <ul className="space-y-3">
              {platformLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Industries */}
          <div>
            <h4 className="text-sm font-semibold text-gold-400 uppercase tracking-wider mb-4">Industries</h4>
            <ul className="space-y-3">
              {industryLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-gold-400 uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} Invaria Labs. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Privacy Policy</Link>
            <Link href="#" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
