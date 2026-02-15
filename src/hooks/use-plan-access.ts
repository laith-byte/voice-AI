"use client";

import { useState, useEffect } from "react";
import type { PlanAccess } from "@/lib/plan-access";

export function usePlanAccess() {
  const [data, setData] = useState<PlanAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchPlanAccess() {
      try {
        const res = await fetch("/api/client/plan-access");
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setData(json);
        }
      } catch {
        // silently fail — data stays null
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPlanAccess();
    return () => { cancelled = true; };
  }, []);

  return { planAccess: data, loading };
}
