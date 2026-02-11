"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { TabNav } from "@/components/layout/tab-nav";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function ClientDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const id = params.id as string;

  const [clientName, setClientName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClient() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("clients")
        .select("name")
        .eq("id", id)
        .single();

      if (data && !error) {
        setClientName(data.name);
      } else {
        setClientName("Client Details");
      }
      setLoading(false);
    }

    fetchClient();
  }, [id]);

  const tabs = [
    { label: "Overview", href: `/clients/${id}/overview` },
    { label: "Assigned Agents", href: `/clients/${id}/assigned-agents` },
    { label: "Phone Numbers", href: `/clients/${id}/phone-numbers` },
    { label: "Solutions", href: `/clients/${id}/solutions` },
    { label: "Client Access", href: `/clients/${id}/client-access` },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#111827]">
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </span>
          ) : (
            clientName
          )}
        </h1>
        <p className="text-sm text-[#6b7280] mt-1">
          Configure client settings, access, and integrations
        </p>
      </div>

      {/* Tab Navigation */}
      <TabNav tabs={tabs} />

      {/* Tab Content */}
      <div>{children}</div>
    </div>
  );
}
