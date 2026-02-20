"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ShieldOff, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpgradeBanner } from "@/components/portal/upgrade-banner";

// Map feature names to plan column fields
// Features without a mapping (knowledge_base, conversations, leads) are intentionally
// ungated — they have no boolean plan field and are available to all plans.
const FEATURE_TO_PLAN_FIELD: Record<string, string> = {
  topics: "topic_management",
  agent_settings: "raw_prompt_editor",
  campaigns: "campaign_outbound",
  analytics: "analytics_full",
  ai_analysis: "ai_evaluation",
  automations: "sms_notification",
  conversation_flows: "conversation_flows",
};

// Map features to the plan name required
const FEATURE_UPGRADE_PLAN: Record<string, string> = {
  topics: "Professional",
  agent_settings: "Professional",
  campaigns: "Professional",
  ai_analysis: "Professional",
  automations: "Professional",
};

export function FeatureGate({
  feature,
  planField,
  children,
}: {
  feature: string;
  planField?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [blockedByPlan, setBlockedByPlan] = useState(false);

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

      // 1. Check client_access first (admin override)
      const { data: access } = await supabase
        .from("client_access")
        .select("enabled")
        .eq("client_id", userData.client_id)
        .eq("feature", feature)
        .single();

      // If explicit client_access record exists, use it
      if (access) {
        setAllowed(access.enabled);
        if (!access.enabled) setBlockedByPlan(false);
        return;
      }

      // 2. Fall back to plan column check
      const fieldName = planField || FEATURE_TO_PLAN_FIELD[feature];
      if (fieldName) {
        try {
          const res = await fetch("/api/client/plan-access");
          if (res.ok) {
            const planAccess = await res.json();
            const fieldValue = planAccess[fieldName];
            // For agent_settings, check if any advanced feature is enabled
            if (feature === "agent_settings") {
              const hasAccess = planAccess.raw_prompt_editor || planAccess.speech_settings_full;
              setAllowed(hasAccess);
              if (!hasAccess) setBlockedByPlan(true);
              return;
            }
            const isAllowed = typeof fieldValue === "boolean" ? fieldValue : true;
            setAllowed(isAllowed);
            if (!isAllowed) setBlockedByPlan(true);
            return;
          }
        } catch {
          // Fall through to default
        }
      }

      // Default: allow if no record exists (matches sidebar behavior)
      setAllowed(true);
    }

    check();
  }, [feature, planField]);

  if (allowed === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
      </div>
    );
  }

  if (!allowed) {
    // If blocked by plan, show upgrade banner instead of generic restricted
    if (blockedByPlan) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] px-4">
          <UpgradeBanner
            feature={feature.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            plan={FEATURE_UPGRADE_PLAN[feature] || "Professional"}
            description={`This feature requires a higher plan. Upgrade to unlock ${feature.replace(/_/g, " ")}.`}
          />
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Go Back
          </Button>
        </div>
      );
    }

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
