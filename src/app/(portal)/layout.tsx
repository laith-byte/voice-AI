import { PortalSidebar } from "@/components/layout/portal-sidebar";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <PortalSidebar />
      <main className="md:ml-60 min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
