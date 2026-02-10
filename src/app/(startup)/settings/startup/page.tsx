"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Upload,
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function SettingsStartupPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [startupName, setStartupName] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [gdprEnabled, setGdprEnabled] = useState(false);
  const [hipaaEnabled, setHipaaEnabled] = useState(false);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    try {
      // 1. Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Get user's organization_id from users table
      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (!userData?.organization_id) return;

      const organizationId = userData.organization_id;
      setOrgId(organizationId);

      // 3. Fetch organization details
      const { data: org } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", organizationId)
        .single();

      if (org) {
        setStartupName(org.name ?? "");
        setWorkspaceId(org.id ?? "");
      }

      // 4. Fetch organization_settings
      const { data: settings } = await supabase
        .from("organization_settings")
        .select("gdpr_enabled, hipaa_enabled, openai_api_key_encrypted")
        .eq("organization_id", organizationId)
        .single();

      if (settings) {
        setGdprEnabled(settings.gdpr_enabled ?? false);
        setHipaaEnabled(settings.hipaa_enabled ?? false);
        setApiKey(settings.openai_api_key_encrypted ?? "");
      }
    } catch (error) {
      console.error("Failed to fetch startup settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleCopy(field: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function handleSave() {
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ name: startupName })
        .eq("id", orgId);
      if (error) {
        console.error("Failed to save organization name:", error);
      }
    } catch (error) {
      console.error("Failed to save organization name:", error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dashboard Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-[#e5e7eb] rounded-lg p-8 flex flex-col items-center justify-center hover:border-[#2563eb] transition-colors cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Upload className="h-5 w-5 text-[#6b7280]" />
            </div>
            <p className="text-sm font-medium text-[#111827]">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-[#6b7280] mt-1">
              SVG, PNG or JPG (max. 800x400px)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Login Page Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Login Page Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-[#e5e7eb] rounded-lg p-8 flex flex-col items-center justify-center hover:border-[#2563eb] transition-colors cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Upload className="h-5 w-5 text-[#6b7280]" />
            </div>
            <p className="text-sm font-medium text-[#111827]">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-[#6b7280] mt-1">
              SVG, PNG or JPG (max. 800x400px)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Startup Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Startup Name</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={startupName}
            onChange={(e) => setStartupName(e.target.value)}
            className="max-w-sm"
          />
          <Button
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white mt-3"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </CardContent>
      </Card>

      {/* Workspace ID */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace ID</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 max-w-sm">
            <Input value={workspaceId} readOnly className="bg-gray-50 font-mono text-sm" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy("workspace", workspaceId)}
            >
              {copiedField === "workspace" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI API Key</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 max-w-sm">
            <div className="relative flex-1">
              <Input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                readOnly
                className="pr-10 font-mono text-sm"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4 text-[#6b7280]" />
                ) : (
                  <Eye className="h-4 w-4 text-[#6b7280]" />
                )}
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy("apikey", apiKey)}
            >
              {copiedField === "apikey" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* GDPR */}
          <div className="flex items-center justify-between py-3 border-b border-[#e5e7eb]">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#111827]">GDPR</span>
            </div>
            <div className="flex items-center gap-2">
              {gdprEnabled ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">Enabled</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-500 font-medium">Not Enabled</span>
                </>
              )}
            </div>
          </div>

          {/* HIPAA */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#111827]">HIPAA</span>
            </div>
            <div className="flex items-center gap-3">
              {hipaaEnabled ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">Enabled</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-500 font-medium">Not Enabled</span>
                  </div>
                  <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs h-8">
                    Get HIPAA Compliance
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <CardTitle className="text-base text-red-600">Danger Zone</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#6b7280] mb-4">
            Once you delete your organization, there is no going back. This action
            is irreversible and will permanently remove all data associated with
            your startup.
          </p>
          <Button
            variant="outline"
            className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700"
          >
            Delete Organization
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
