"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Upload,
  ExternalLink,
  Trash2,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const themeColors = [
  "#2563eb", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
  "#ef4444", "#f97316", "#eab308", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#0ea5e9",
];

const loadingIcons = [
  { name: "Infinity", value: "infinity" },
  { name: "Spinner", value: "spinner" },
  { name: "Dots", value: "dots" },
  { name: "Ring", value: "ring" },
  { name: "Ball", value: "ball" },
  { name: "Bars", value: "bars" },
];

const loadingSizes = ["XS", "SM", "MD", "LG"];

type TemplateType = "password_setup" | "password_reset" | "startup_invite";

interface EmailTemplateRow {
  id: string;
  organization_id: string;
  template_type: string;
  subject: string;
  greeting: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export default function SettingsWhitelabelPage() {
  const [loading, setLoading] = useState(true);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Branding state
  const [selectedColor, setSelectedColor] = useState("#2563eb");
  const [selectedIcon, setSelectedIcon] = useState("infinity");
  const [selectedSize, setSelectedSize] = useState("MD");
  const [websiteTitle, setWebsiteTitle] = useState("");

  // Domain state
  const [domain, setDomain] = useState("");
  const [domainValid, setDomainValid] = useState(false);
  const [backendDomain, setBackendDomain] = useState("");

  // Email state
  const [sendingDomain, setSendingDomain] = useState("");
  const [sendingDomainValid, setSendingDomainValid] = useState(false);
  const [senderAddress, setSenderAddress] = useState("");
  const [senderName, setSenderName] = useState("");

  // Email templates state
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateRow[]>([]);
  const [emailTemplate, setEmailTemplate] = useState<TemplateType>("password_setup");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailGreeting, setEmailGreeting] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const availableVariables = [
    "{{startup_name}}",
    "{{client_name}}",
    "{{client_email}}",
    "{{login_url}}",
    "{{support_email}}",
  ];

  const loadTemplateIntoForm = useCallback(
    (templateType: TemplateType, templates: EmailTemplateRow[]) => {
      const tpl = templates.find((t) => t.template_type === templateType);
      if (tpl) {
        setEmailSubject(tpl.subject ?? "");
        setEmailGreeting(tpl.greeting ?? "");
        setEmailBody(tpl.body ?? "");
      } else {
        setEmailSubject("");
        setEmailGreeting("");
        setEmailBody("");
      }
    },
    []
  );

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    try {
      // 1. Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Get user's organization_id
      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (!userData?.organization_id) return;

      const organizationId = userData.organization_id;
      setOrgId(organizationId);

      // 3. Fetch whitelabel_settings
      const { data: wl } = await supabase
        .from("whitelabel_settings")
        .select(
          "color_theme, loading_icon, loading_icon_size, website_title, domain, domain_valid, backend_domain, sending_domain, sending_domain_valid, sender_address, sender_name, favicon_url, email_logo_url"
        )
        .eq("organization_id", organizationId)
        .single();

      if (wl) {
        setSelectedColor(wl.color_theme ?? "#2563eb");
        setSelectedIcon(wl.loading_icon ?? "infinity");
        setSelectedSize(wl.loading_icon_size ?? "MD");
        setWebsiteTitle(wl.website_title ?? "");
        setDomain(wl.domain ?? "");
        setDomainValid(wl.domain_valid ?? false);
        setBackendDomain(wl.backend_domain ?? "");
        setSendingDomain(wl.sending_domain ?? "");
        setSendingDomainValid(wl.sending_domain_valid ?? false);
        setSenderAddress(wl.sender_address ?? "");
        setSenderName(wl.sender_name ?? "");
      }

      // 4. Fetch email_templates
      const { data: templates } = await supabase
        .from("email_templates")
        .select("*")
        .eq("organization_id", organizationId);

      if (templates && templates.length > 0) {
        setEmailTemplates(templates as EmailTemplateRow[]);
        loadTemplateIntoForm("password_setup", templates as EmailTemplateRow[]);
      }
    } catch (error) {
      console.error("Failed to fetch whitelabel settings:", error);
    } finally {
      setLoading(false);
    }
  }, [loadTemplateIntoForm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // When user switches template type, load that template's data into the form
  function handleTemplateTypeChange(value: TemplateType) {
    setEmailTemplate(value);
    loadTemplateIntoForm(value, emailTemplates);
  }

  async function handleSaveBranding() {
    if (!orgId) return;
    setSavingBranding(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("whitelabel_settings")
        .upsert(
          {
            organization_id: orgId,
            color_theme: selectedColor,
            loading_icon: selectedIcon,
            loading_icon_size: selectedSize,
            website_title: websiteTitle,
            domain,
            backend_domain: backendDomain,
            sending_domain: sendingDomain,
            sender_address: senderAddress,
            sender_name: senderName,
          },
          { onConflict: "organization_id" }
        );
      if (error) {
        console.error("Failed to save branding settings:", error);
        toast.error("Failed to save branding settings.");
      } else {
        toast.success("Branding & domain settings saved.");
      }
    } catch (error) {
      console.error("Failed to save branding settings:", error);
      toast.error("Failed to save branding settings.");
    } finally {
      setSavingBranding(false);
    }
  }

  async function handleSaveTemplate() {
    if (!orgId) return;
    setSavingTemplate(true);
    const supabase = createClient();
    try {
      // Find existing template for this type
      const existing = emailTemplates.find(
        (t) => t.template_type === emailTemplate
      );

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from("email_templates")
          .update({
            subject: emailSubject,
            greeting: emailGreeting,
            body: emailBody,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) {
          console.error("Failed to save email template:", error);
          toast.error("Failed to save email template.");
        } else if (data) {
          setEmailTemplates((prev) =>
            prev.map((t) =>
              t.id === existing.id ? (data as EmailTemplateRow) : t
            )
          );
          toast.success("Email template saved.");
        }
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("email_templates")
          .insert({
            organization_id: orgId,
            template_type: emailTemplate,
            subject: emailSubject,
            greeting: emailGreeting,
            body: emailBody,
          })
          .select()
          .single();

        if (error) {
          console.error("Failed to save email template:", error);
          toast.error("Failed to save email template.");
        } else if (data) {
          setEmailTemplates((prev) => [...prev, data as EmailTemplateRow]);
          toast.success("Email template saved.");
        }
      }
    } catch (error) {
      console.error("Failed to save email template:", error);
      toast.error("Failed to save email template.");
    } finally {
      setSavingTemplate(false);
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
    <div className="space-y-8">
      {/* BRANDING SECTION */}
      <div>
        <h2 className="text-lg font-semibold text-[#111827] mb-4">Branding</h2>

        {/* Favicon */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Favicon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-[#e5e7eb] rounded-lg p-6 flex flex-col items-center justify-center hover:border-[#2563eb] transition-colors cursor-pointer max-w-xs">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                <Upload className="h-4 w-4 text-[#6b7280]" />
              </div>
              <p className="text-xs text-[#6b7280]">Upload favicon (32x32px)</p>
            </div>
          </CardContent>
        </Card>

        {/* Website Title */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Website Title</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={websiteTitle}
              onChange={(e) => setWebsiteTitle(e.target.value)}
              className="max-w-sm"
            />
          </CardContent>
        </Card>

        {/* Color Theme */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Color Theme</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-8 gap-3 max-w-xs">
              {themeColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    selectedColor === color
                      ? "border-[#111827] scale-110 shadow-md"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <p className="text-xs text-[#6b7280] mt-3">
              Selected: {selectedColor}
            </p>
          </CardContent>
        </Card>

        {/* Loading Icon */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Loading Icon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {loadingIcons.map((icon) => (
                <button
                  key={icon.value}
                  onClick={() => setSelectedIcon(icon.value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                    selectedIcon === icon.value
                      ? "border-[#2563eb] bg-blue-50"
                      : "border-[#e5e7eb] hover:border-gray-300"
                  }`}
                >
                  <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                    <div
                      className="w-4 h-4 rounded-full border-2 border-[#2563eb] border-t-transparent animate-spin"
                    />
                  </div>
                  <span className="text-xs text-[#6b7280]">{icon.name}</span>
                </button>
              ))}
            </div>

            {/* Loading Icon Size */}
            <div>
              <label className="block text-sm font-medium text-[#111827] mb-2">
                Loading Icon Size
              </label>
              <div className="flex items-center gap-2">
                {loadingSizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                      selectedSize === size
                        ? "border-[#2563eb] bg-blue-50 text-[#2563eb]"
                        : "border-[#e5e7eb] text-[#6b7280] hover:border-gray-300"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Branding Button */}
        <Button
          className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
          onClick={handleSaveBranding}
          disabled={savingBranding}
        >
          {savingBranding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Branding & Domain Settings
        </Button>
      </div>

      {/* DOMAIN SECTION */}
      <div>
        <h2 className="text-lg font-semibold text-[#111827] mb-4">Domain</h2>

        <Card className="mb-4">
          <CardContent className="p-6 space-y-4">
            {/* Primary Domain */}
            <div>
              <label className="block text-sm font-medium text-[#111827] mb-2">
                Domain
              </label>
              <div className="flex items-center gap-3">
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="max-w-sm"
                />
                {domain && (
                  domainValid ? (
                    <Badge
                      variant="secondary"
                      className="bg-green-50 text-green-700 border border-green-200"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Valid
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="bg-red-50 text-red-700 border border-red-200"
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Not Verified
                    </Badge>
                  )
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Remove
                </Button>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Launch
                </Button>
              </div>
            </div>

            {/* Backend Domain */}
            <div>
              <label className="block text-sm font-medium text-[#111827] mb-2">
                Backend Domain
              </label>
              <Input
                value={backendDomain}
                onChange={(e) => setBackendDomain(e.target.value)}
                placeholder="api.yourdomain.com"
                className="max-w-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* EMAIL SECTION */}
      <div>
        <h2 className="text-lg font-semibold text-[#111827] mb-4">Email</h2>

        <Card className="mb-4">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-2">
                  Sending Domain
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={sendingDomain}
                    onChange={(e) => setSendingDomain(e.target.value)}
                    placeholder="mail.yourdomain.com"
                  />
                  {sendingDomain && (
                    sendingDomainValid ? (
                      <Badge
                        variant="secondary"
                        className="bg-green-50 text-green-700 border border-green-200 shrink-0"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Valid
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-red-50 text-red-700 border border-red-200 shrink-0"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Not Verified
                      </Badge>
                    )
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-2">
                  Sender Address
                </label>
                <Input
                  value={senderAddress}
                  onChange={(e) => setSenderAddress(e.target.value)}
                  placeholder="noreply@yourdomain.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-2">
                  Sender Name
                </label>
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Invaria Labs"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-2">
                  Email Logo
                </label>
                <div className="border-2 border-dashed border-[#e5e7eb] rounded-lg p-4 flex items-center justify-center hover:border-[#2563eb] transition-colors cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-[#6b7280]" />
                    <span className="text-xs text-[#6b7280]">Upload logo</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* EMAIL TEMPLATES SECTION */}
      <div>
        <h2 className="text-lg font-semibold text-[#111827] mb-4">
          Email Templates
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Template Editor */}
          <Card>
            <CardContent className="p-6 space-y-4">
              {/* Template Type */}
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-2">
                  Template Type
                </label>
                <Select value={emailTemplate} onValueChange={(v) => handleTemplateTypeChange(v as TemplateType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="password_setup">Password Setup</SelectItem>
                    <SelectItem value="password_reset">Password Reset</SelectItem>
                    <SelectItem value="startup_invite">Startup Invite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Available Variables */}
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-2">
                  Available Variables
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableVariables.map((variable) => (
                    <code
                      key={variable}
                      className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-[#6b7280] cursor-pointer hover:bg-gray-200 transition-colors"
                    >
                      {variable}
                    </code>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-2">
                  Subject
                </label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>

              {/* Greeting */}
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-2">
                  Greeting
                </label>
                <Input
                  value={emailGreeting}
                  onChange={(e) => setEmailGreeting(e.target.value)}
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-2">
                  Body
                </label>
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={6}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" size="sm">
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Send Test Email
                </Button>
                <Button
                  className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
                  size="sm"
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate}
                >
                  {savingTemplate && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Live Email Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live Email Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-6 min-h-[400px]">
                {/* Email Header */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div
                    className="h-2"
                    style={{ backgroundColor: selectedColor }}
                  />
                  <div className="p-6">
                    {/* Logo placeholder */}
                    <div className="w-32 h-8 bg-gray-200 rounded mb-6" />

                    {/* Subject */}
                    <p className="text-xs text-[#6b7280] mb-4">
                      Subject: {emailSubject.replace("{{startup_name}}", websiteTitle || "Invaria Labs")}
                    </p>

                    {/* Greeting */}
                    <p className="text-sm font-medium text-[#111827] mb-3">
                      {emailGreeting.replace("{{client_name}}", "John Doe")}
                    </p>

                    {/* Body */}
                    <p className="text-sm text-[#6b7280] leading-relaxed">
                      {emailBody
                        .replace(/\{\{startup_name\}\}/g, websiteTitle || "Invaria Labs")
                        .replace(/\{\{client_name\}\}/g, "John Doe")
                        .replace(/\{\{client_email\}\}/g, "john@example.com")
                        .replace(/\{\{login_url\}\}/g, domain ? `https://${domain}/login` : "https://app.invaria.io/login")
                        .replace(/\{\{support_email\}\}/g, senderAddress || "support@invaria.io")}
                    </p>

                    {/* Footer */}
                    <div className="mt-6 pt-4 border-t border-[#e5e7eb]">
                      <p className="text-xs text-[#6b7280]">
                        &copy; 2025 {websiteTitle || "Invaria Labs"}. All rights reserved.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
