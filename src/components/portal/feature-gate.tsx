"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ShieldOff, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FeatureGate({
  feature,
  children,
}: {
  feature: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAllowed(false);
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("client_id, role")
        .eq("id", user.id)
        .single();

      // Startup users always have access
      if (
        userData?.role === "startup_owner" ||
        userData?.role === "startup_admin"
      ) {
        setAllowed(true);
        return;
      }

      if (!userData?.client_id) {
        setAllowed(false);
        return;
      }

      const { data: access } = await supabase
        .from("client_access")
        .select("enabled")
        .eq("client_id", userData.client_id)
        .eq("feature", feature)
        .single();

      // If no record exists, allow by default (matches sidebar behavior)
      setAllowed(access ? access.enabled : true);
    }

    check();
  }, [feature]);

  if (allowed === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <ShieldOff className="w-6 h-6 text-[#6b7280]" />
        </div>
        <h2 className="text-lg font-semibold text-[#111827]">
          Access Restricted
        </h2>
        <p className="text-sm text-[#6b7280] mt-1 max-w-sm">
          This feature has been disabled by your administrator. Contact them if
          you need access.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Go Back
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
