import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StartupSidebar } from "@/components/layout/startup-sidebar";

export default async function StartupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <StartupSidebar />
      <main className="md:ml-60 min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
