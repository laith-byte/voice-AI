"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export function useOnboarding() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkOnboarding() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("onboarding_completed_at")
        .eq("id", user.id)
        .single();

      if (data && !data.onboarding_completed_at) {
        setShowTutorial(true);
      }

      setLoading(false);
    }

    checkOnboarding();
  }, []);

  const completeTutorial = useCallback(async () => {
    setShowTutorial(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("users")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("id", user.id);
    }
  }, []);

  const retriggerTutorial = useCallback(() => {
    setShowTutorial(true);
  }, []);

  return { showTutorial, setShowTutorial, loading, completeTutorial, retriggerTutorial };
}
