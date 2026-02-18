import { Inter, Manrope } from "next/font/google";
import { Navbar } from "@/components/marketing/layout/navbar";
import { Footer } from "@/components/marketing/layout/footer";

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

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${inter.variable} ${manrope.variable} marketing-pages font-body antialiased`}
    >
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}
