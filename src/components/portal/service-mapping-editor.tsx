"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

interface ServiceMapping {
  id?: string;
  internal_service_name: string;
  external_category_name: string | null;
  external_category_id: string | null;
  default_duration_minutes: number;
  default_price_cents: number | null;
  isNew?: boolean;
}

interface ServiceMappingEditorProps {
  provider: string;
  providerLabel: string;
}

export function ServiceMappingEditor({
  provider,
  providerLabel,
}: ServiceMappingEditorProps) {
  const [mappings, setMappings] = useState<ServiceMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchMappings = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/integrations/service-mappings?provider=${provider}`
      );
      if (res.ok) {
        const data = await res.json();
        setMappings(data.mappings || []);
      }
    } catch {
      toast.error("Failed to load service mappings");
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  function addRow() {
    setMappings((prev) => [
      ...prev,
      {
        internal_service_name: "",
        external_category_name: "",
        external_category_id: null,
        default_duration_minutes: 60,
        default_price_cents: null,
        isNew: true,
      },
    ]);
  }

  function updateRow(index: number, field: string, value: string | number | null) {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  async function saveRow(index: number) {
    const mapping = mappings[index];
    if (!mapping.internal_service_name) {
      toast.error("Service name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/integrations/service-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          internal_service_name: mapping.internal_service_name,
          external_category_name: mapping.external_category_name,
          external_category_id: mapping.external_category_id,
          default_duration_minutes: mapping.default_duration_minutes,
          default_price_cents: mapping.default_price_cents,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      const data = await res.json();
      setMappings((prev) =>
        prev.map((m, i) =>
          i === index ? { ...data.mapping, isNew: false } : m
        )
      );
      toast.success("Mapping saved");
    } catch {
      toast.error("Failed to save mapping");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(index: number) {
    const mapping = mappings[index];

    if (mapping.isNew || !mapping.id) {
      setMappings((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    try {
      const res = await fetch(
        `/api/integrations/service-mappings?id=${mapping.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete");

      setMappings((prev) => prev.filter((_, i) => i !== index));
      toast.success("Mapping removed");
    } catch {
      toast.error("Failed to delete mapping");
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48 shimmer" />
        </CardHeader>
        <CardContent>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full mb-2 shimmer" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Service Mappings — {providerLabel}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
            <Plus className="w-3 h-3" />
            Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Map your services to {providerLabel} job categories for automatic job creation.
        </p>
      </CardHeader>
      <CardContent>
        {mappings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No service mappings configured. Click &quot;Add&quot; to create one.
          </p>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
              <div className="col-span-3">Your Service</div>
              <div className="col-span-3">{providerLabel} Category</div>
              <div className="col-span-2">Duration (min)</div>
              <div className="col-span-2">Price ($)</div>
              <div className="col-span-2">Actions</div>
            </div>
            {/* Rows */}
            {mappings.map((mapping, index) => (
              <div key={mapping.id || `new-${index}`} className="grid grid-cols-12 gap-2 items-center">
                <Input
                  className="col-span-3 h-8 text-sm"
                  placeholder="e.g. AC Repair"
                  value={mapping.internal_service_name}
                  onChange={(e) =>
                    updateRow(index, "internal_service_name", e.target.value)
                  }
                />
                <Input
                  className="col-span-3 h-8 text-sm"
                  placeholder="CRM category"
                  value={mapping.external_category_name || ""}
                  onChange={(e) =>
                    updateRow(index, "external_category_name", e.target.value)
                  }
                />
                <Input
                  className="col-span-2 h-8 text-sm"
                  type="number"
                  value={mapping.default_duration_minutes}
                  onChange={(e) =>
                    updateRow(
                      index,
                      "default_duration_minutes",
                      parseInt(e.target.value) || 60
                    )
                  }
                />
                <Input
                  className="col-span-2 h-8 text-sm"
                  type="number"
                  placeholder="0.00"
                  value={
                    mapping.default_price_cents
                      ? (mapping.default_price_cents / 100).toFixed(2)
                      : ""
                  }
                  onChange={(e) =>
                    updateRow(
                      index,
                      "default_price_cents",
                      e.target.value
                        ? Math.round(parseFloat(e.target.value) * 100)
                        : null
                    )
                  }
                />
                <div className="col-span-2 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => saveRow(index)}
                    disabled={saving}
                  >
                    <Save className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                    onClick={() => deleteRow(index)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
