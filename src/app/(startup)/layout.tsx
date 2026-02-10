import { StartupSidebar } from "@/components/layout/startup-sidebar";

export default function StartupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <StartupSidebar />
      <main className="md:ml-60 min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
