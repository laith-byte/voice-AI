"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function EmbedUrlPage() {
  const params = useParams();
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchEmbedDomain = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${params.id}/embed-url`);
      if (res.ok) {
        const data = await res.json();
        setDomain(data.embed_domain || "");
      }
    } catch {
      // Silently fail on load
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchEmbedDomain();
  }, [fetchEmbedDomain]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${params.id}/embed-url`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embed_domain: domain.trim() }),
      });
      if (res.ok) {
        toast.success("Embed domain saved.");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save embed domain.");
      }
    } catch {
      toast.error("Failed to save embed domain.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Domain Configuration */}
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Globe className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">Embed Domain</CardTitle>
              <p className="text-sm text-[#6b7280] mt-0.5">
                Configure the domain for white-label widget embedding
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="embed-domain">Allowed Domain</Label>
            <Input
              id="embed-domain"
              placeholder="https://app.clientdomain.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <p className="text-xs text-[#6b7280]">
              Enter the domain where the client will embed the widget. The
              widget will only load on this domain for security purposes.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-[#e5e7eb]">
            <p className="text-xs font-medium text-[#111827] mb-2">
              Embed Code Preview
            </p>
            <pre className="text-xs text-[#6b7280] bg-white p-3 rounded border border-[#e5e7eb] overflow-x-auto">
              <code>{`<script src="${process.env.NEXT_PUBLIC_EMBED_WIDGET_URL || "https://embed.invarialabs.com/widget.js"}"
  data-client-id="${params.id}"
  data-domain="${domain || 'your-domain.com'}"
></script>`}</code>
            </pre>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              onClick={handleSave}
              disabled={!domain.trim() || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1.5" />
                  Save Domain
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
