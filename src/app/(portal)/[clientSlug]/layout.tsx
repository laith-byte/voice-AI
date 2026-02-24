import { PortalSidebar } from "@/components/layout/portal-sidebar";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { DashboardThemeProvider } from "@/components/portal/dashboard-theme-provider";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;

  return (
    <DashboardThemeProvider>
      <OnboardingProvider>
        <div className="min-h-screen bg-background">
          <PortalSidebar clientSlug={clientSlug} />
          <main className="md:ml-60 min-h-screen pt-14 md:pt-0">
            <div className="h-[2px] bg-gradient-to-r from-primary/80 via-primary/30 to-transparent" />
            {children}
          </main>
        </div>
      </OnboardingProvider>
    </DashboardThemeProvider>
  );
}
