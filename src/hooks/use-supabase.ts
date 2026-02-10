"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/types/database";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      setUser(data);
      setLoading(false);
    }

    fetchUser();
  }, []);

  return { user, loading };
}

export function useOrganization() {
  const { user, loading: userLoading } = useUser();
  const [org, setOrg] = useState<{ id: string; name: string; slug: string; logo_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrg() {
      if (!user?.organization_id) {
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url")
        .eq("id", user.organization_id)
        .single();

      setOrg(data);
      setLoading(false);
    }

    if (!userLoading) fetchOrg();
  }, [user, userLoading]);

  return { org, loading: loading || userLoading };
}
