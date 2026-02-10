"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Shield, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface FeatureAccess {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

const featureMeta: Record<string, { label: string; description: string }> = {
  workflows: {
    label: "Workflows",
    description: "Allow client to view and manage agent workflows",
  },
  phone_numbers: {
    label: "Phone Numbers",
    description:
      "Allow client to view assigned phone numbers and call routing",
  },
  analytics: {
    label: "Analytics",
    description:
      "Allow client to access call analytics and reporting dashboards",
  },
  conversations: {
    label: "Conversations",
    description:
      "Allow client to view call transcripts and conversation history",
  },
  knowledge_base: {
    label: "Knowledge Base",
    description: "Allow client to manage agent knowledge base documents",
  },
  topics: {
    label: "Topics",
    description: "Allow client to view and configure conversation topics",
  },
  agent_settings: {
    label: "Agent Settings",
    description: "Allow client to modify agent configuration and behavior",
  },
  leads: {
    label: "Leads",
    description: "Allow client to view and manage captured leads",
  },
  campaigns: {
    label: "Campaigns",
    description:
      "Allow client to create and manage outbound call campaigns",
  },
};

const defaultEnabledMap: Record<string, boolean> = {
  workflows: true,
  phone_numbers: true,
  analytics: true,
  conversations: true,
  knowledge_base: false,
  topics: false,
  agent_settings: false,
  leads: true,
  campaigns: false,
};

const featureKeys = [
  "workflows",
  "phone_numbers",
  "analytics",
  "conversations",
  "knowledge_base",
  "topics",
  "agent_settings",
  "leads",
  "campaigns",
];

export default function ClientAccessPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [features, setFeatures] = useState<FeatureAccess[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchFeatures = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);

    const { data, error } = await supabase
      .from("client_access")
      .select("*")
      .eq("client_id", clientId);

    if (error) {
      console.error("Error fetching client access:", error);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      // No records yet -- seed defaults
      const inserts = featureKeys.map((key) => ({
        client_id: clientId,
        feature: key,
        enabled: defaultEnabledMap[key],
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("client_access")
        .insert(inserts)
        .select();

      if (insertError) {
        console.error("Error seeding client access defaults:", insertError);
        setLoading(false);
        return;
      }

      const mapped = featureKeys.map((key) => {
        const record = inserted?.find((r: { feature: string }) => r.feature === key);
        return {
          key,
          label: featureMeta[key].label,
          description: featureMeta[key].description,
          enabled: record ? record.enabled : defaultEnabledMap[key],
        };
      });

      setFeatures(mapped);
    } else {
      // Build feature list from existing records, preserving the canonical order
      const mapped = featureKeys.map((key) => {
        const record = data.find((r: { feature: string }) => r.feature === key);
        return {
          key,
          label: featureMeta[key].label,
          description: featureMeta[key].description,
          enabled: record ? record.enabled : defaultEnabledMap[key],
        };
      });

      setFeatures(mapped);
    }

    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const handleToggle = (key: string) => {
    setFeatures((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    const supabase = createClient();
    setSaving(true);

    const upserts = features.map((f) => ({
      client_id: clientId,
      feature: f.key,
      enabled: f.enabled,
    }));

    const { error } = await supabase
      .from("client_access")
      .upsert(upserts, { onConflict: "client_id,feature" });

    if (error) {
      console.error("Error saving client access:", error);
    } else {
      setHasChanges(false);
    }

    setSaving(false);
  };

  const enabledCount = features.filter((f) => f.enabled).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="rounded-lg">
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
            <span className="ml-2 text-sm text-[#6b7280]">
              Loading feature permissions...
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Feature Permissions</CardTitle>
              <p className="text-sm text-[#6b7280] mt-1">
                Control which dashboard features this client can access.{" "}
                <span className="font-medium">
                  {enabledCount} of {features.length}
                </span>{" "}
                features enabled.
              </p>
            </div>
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-[#e5e7eb]">
            {features.map((feature) => (
              <div
                key={feature.key}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-[#6b7280]" />
                  </div>
                  <div>
                    <Label
                      htmlFor={`feature-${feature.key}`}
                      className="text-sm font-medium text-[#111827] cursor-pointer"
                    >
                      {feature.label}
                    </Label>
                    <p className="text-xs text-[#6b7280] mt-0.5">
                      {feature.description}
                    </p>
                  </div>
                </div>
                <Switch
                  id={`feature-${feature.key}`}
                  checked={feature.enabled}
                  onCheckedChange={() => handleToggle(feature.key)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
