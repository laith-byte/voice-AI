"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
    setLoading(true);

    try {
      const res = await fetch(`/api/clients/${clientId}/client-access`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Error fetching client access:", data.error);
        setLoading(false);
        return;
      }

      const { features: records } = await res.json();

      // Build feature list from records, preserving the canonical order
      const mapped = featureKeys.map((key) => {
        const record = records?.find((r: { feature: string }) => r.feature === key);
        return {
          key,
          label: featureMeta[key].label,
          description: featureMeta[key].description,
          enabled: record ? record.enabled : defaultEnabledMap[key],
        };
      });

      setFeatures(mapped);
    } catch (err) {
      console.error("Error fetching client access:", err);
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
    setSaving(true);

    try {
      const res = await fetch(`/api/clients/${clientId}/client-access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          features: features.map((f) => ({ key: f.key, enabled: f.enabled })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Error saving client access:", data.error);
        toast.error("Failed to save permissions. Please try again.");
      } else {
        setHasChanges(false);
        toast.success("Feature permissions saved.");
      }
    } catch (err) {
      console.error("Error saving client access:", err);
      toast.error("Failed to save permissions. Please try again.");
    }

    setSaving(false);
  };

  const enabledCount = features.filter((f) => f.enabled).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="rounded-lg">
          <CardContent className="min-h-[400px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
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
