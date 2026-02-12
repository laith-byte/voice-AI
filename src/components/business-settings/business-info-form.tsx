"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface BusinessInfoFormProps {
  clientId?: string;
}

function apiUrl(path: string, clientId?: string) {
  const base = `/api/business-settings${path}`;
  return clientId ? `${base}?client_id=${clientId}` : base;
}

export function BusinessInfoForm({ clientId }: BusinessInfoFormProps) {
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("", clientId));
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      const settings = data.settings ?? data;
      if (settings) {
        setBusinessName(settings.business_name ?? "");
        setBusinessPhone(settings.business_phone ?? "");
        setBusinessWebsite(settings.business_website ?? "");
        setBusinessAddress(settings.business_address ?? "");
      }
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave() {
    setSaving(true);
    const payload = {
      business_name: businessName.trim() || null,
      business_phone: businessPhone.trim() || null,
      business_website: businessWebsite.trim() || null,
      business_address: businessAddress.trim() || null,
    };

    try {
      const res = await fetch(apiUrl("", clientId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? "Failed to save settings");
      }

      toast.success("Business information saved successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Business Information</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business Name</Label>
            <Input
              id="business-name"
              placeholder="Acme Dental"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-phone">Business Phone</Label>
            <Input
              id="business-phone"
              placeholder="+1 (555) 123-4567"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-website">Website</Label>
            <Input
              id="business-website"
              placeholder="https://example.com"
              value={businessWebsite}
              onChange={(e) => setBusinessWebsite(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-address">Address</Label>
            <Input
              id="business-address"
              placeholder="123 Main St, City, ST 12345"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
