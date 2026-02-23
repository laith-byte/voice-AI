import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
      <body className={`${dmSans.variable} font-sans antialiased`}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
