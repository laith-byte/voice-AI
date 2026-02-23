import type { Metadata } from "next";
import { DM_Sans, Inter, Manrope } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Invaria Labs | Enterprise Voice AI Platform",
    template: "%s | Invaria Labs",
  },
  description:
    "Build, deploy, and manage intelligent voice AI agents for your business. Automate customer calls, boost engagement, and scale operations with Invaria Labs.",
  openGraph: {
    title: "Invaria Labs | Enterprise Voice AI Platform",
    description:
      "Build, deploy, and manage intelligent voice AI agents for your business. Automate customer calls, boost engagement, and scale operations with Invaria Labs.",
    siteName: "Invaria Labs",
    type: "website",
    images: [{ url: "/og-image.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Invaria Labs | Enterprise Voice AI Platform",
    description:
      "Build, deploy, and manage intelligent voice AI agents for your business. Automate customer calls, boost engagement, and scale operations with Invaria Labs.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${inter.variable} ${manrope.variable} font-sans antialiased`}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
