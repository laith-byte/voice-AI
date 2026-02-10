"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function SaaSAdvancedPage() {
  const [redirectUrl, setRedirectUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: dbUser } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (!dbUser) return;

      setOrgId(dbUser.organization_id);

      const { data: settings } = await supabase
        .from("organization_settings")
        .select("payment_success_redirect_url")
        .eq("organization_id", dbUser.organization_id)
        .single();

      if (settings) {
        setRedirectUrl(settings.payment_success_redirect_url || "");
      }
    } catch {
      // Settings row may not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("organization_settings")
        .upsert(
          {
            organization_id: orgId,
            payment_success_redirect_url: redirectUrl.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id" }
        );

      if (error) throw error;

      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Success Redirect */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-[#6b7280]" />
            <div>
              <CardTitle className="text-base">
                Payment Success Redirect URL
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                Redirect users to this URL after a successful payment. Leave
                blank to redirect to the default dashboard.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              type="url"
              placeholder="https://yourdomain.com/thank-you"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              className="max-w-lg"
            />
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
          <p className="text-xs text-[#6b7280] mt-2">
            The user will be redirected to this URL after completing their
            payment on the Stripe checkout page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
