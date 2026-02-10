"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Upload, ChevronDown, Phone, RefreshCw, X, Save, Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface WidgetConfig {
  id: string;
  agent_id: string;
  agent_image_url: string | null;
  widget_layout: string | null;
  description: string | null;
  branding: boolean | null;
  background_image_url: string | null;
  launcher_image_url: string | null;
  google_font_name: string | null;
  color_preset: string | null;
  custom_css: string | null;
  autolaunch_popup: boolean | null;
  launch_message: string | null;
  launch_message_enabled: boolean | null;
  popup_message: string | null;
  popup_message_enabled: boolean | null;
  terms_of_service_url: string | null;
  privacy_policy_url: string | null;
}

export default function WidgetPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [configId, setConfigId] = useState<string | null>(null);

  // Widget config form state
  const [agentImageUrl, setAgentImageUrl] = useState("");
  const [widgetLayout, setWidgetLayout] = useState("compact");
  const [description, setDescription] = useState(
    "Click the button below to start a voice conversation with our AI assistant."
  );
  const [branding, setBranding] = useState(true);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [launcherImageUrl, setLauncherImageUrl] = useState("");
  const [googleFontName, setGoogleFontName] = useState("");
  const [colorPreset, setColorPreset] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [autolaunchPopup, setAutolaunchPopup] = useState(false);
  const [launchMessage, setLaunchMessage] = useState("Hi! Click the call button to talk to me.");
  const [launchMessageEnabled, setLaunchMessageEnabled] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupMessageEnabled, setPopupMessageEnabled] = useState(false);
  const [termsOfServiceUrl, setTermsOfServiceUrl] = useState("");
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("");

  const loadConfig = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // Fetch agent name and widget config in parallel
    const [agentRes, configRes] = await Promise.all([
      supabase.from("agents").select("name").eq("id", agentId).single(),
      supabase.from("widget_config").select("*").eq("agent_id", agentId).single(),
    ]);

    if (agentRes.data) {
      setAgentName(agentRes.data.name ?? "");
    }

    let config: WidgetConfig | null = configRes.data;

    // If no config exists, create a default one
    if (!config) {
      const { data: newConfig, error: insertError } = await supabase
        .from("widget_config")
        .insert({ agent_id: agentId })
        .select()
        .single();

      if (insertError) {
        toast.error("Failed to initialize widget config");
        setLoading(false);
        return;
      }
      config = newConfig;
    }

    if (config) {
      setConfigId(config.id);
      setAgentImageUrl(config.agent_image_url ?? "");
      setWidgetLayout(config.widget_layout ?? "compact");
      setDescription(
        config.description ??
          "Click the button below to start a voice conversation with our AI assistant."
      );
      setBranding(config.branding ?? true);
      setBackgroundImageUrl(config.background_image_url ?? "");
      setLauncherImageUrl(config.launcher_image_url ?? "");
      setGoogleFontName(config.google_font_name ?? "");
      setColorPreset(config.color_preset ?? "");
      setCustomCss(config.custom_css ?? "");
      setAutolaunchPopup(config.autolaunch_popup ?? false);
      setLaunchMessage(config.launch_message ?? "Hi! Click the call button to talk to me.");
      setLaunchMessageEnabled(config.launch_message_enabled ?? false);
      setPopupMessage(config.popup_message ?? "");
      setPopupMessageEnabled(config.popup_message_enabled ?? false);
      setTermsOfServiceUrl(config.terms_of_service_url ?? "");
      setPrivacyPolicyUrl(config.privacy_policy_url ?? "");
    }

    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("widget_config")
      .upsert({
        ...(configId ? { id: configId } : {}),
        agent_id: agentId,
        agent_image_url: agentImageUrl || null,
        widget_layout: widgetLayout,
        description,
        branding,
        background_image_url: backgroundImageUrl || null,
        launcher_image_url: launcherImageUrl || null,
        google_font_name: googleFontName || null,
        color_preset: colorPreset || null,
        custom_css: customCss || null,
        autolaunch_popup: autolaunchPopup,
        launch_message: launchMessage || null,
        launch_message_enabled: launchMessageEnabled,
        popup_message: popupMessage || null,
        popup_message_enabled: popupMessageEnabled,
        terms_of_service_url: termsOfServiceUrl || null,
        privacy_policy_url: privacyPolicyUrl || null,
      });

    if (error) {
      toast.error("Failed to save widget config");
    } else {
      toast.success("Widget config saved");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Widget Configuration</h1>
          <p className="text-muted-foreground text-sm mt-1">Customize the appearance and behavior of your voice widget</p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Left Side - Config */}
        <div className="col-span-3 space-y-4">
          {/* General */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Agent Image</Label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    {agentImageUrl ? (
                      <img
                        src={agentImageUrl}
                        alt="Agent"
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <Bot className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      Upload
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500"
                      onClick={() => setAgentImageUrl("")}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Widget Layout</Label>
                <Select value={widgetLayout} onValueChange={setWidgetLayout}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Branding</Label>
                  <p className="text-xs text-muted-foreground">Show &quot;Powered by Invaria Labs&quot;</p>
                </div>
                <Switch checked={branding} onCheckedChange={setBranding} />
              </div>
            </CardContent>
          </Card>

          {/* Theme */}
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Theme</CardTitle>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Background Color</Label>
                      <div className="flex gap-2">
                        <Input defaultValue="#ffffff" className="flex-1" />
                        <div className="w-10 h-10 rounded-md bg-white border" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Launcher Color</Label>
                      <div className="flex gap-2">
                        <Input defaultValue="#2563eb" className="flex-1" />
                        <div className="w-10 h-10 rounded-md bg-blue-600 border" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Font Color</Label>
                      <div className="flex gap-2">
                        <Input defaultValue="#0f172a" className="flex-1" />
                        <div className="w-10 h-10 rounded-md bg-foreground border" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Accent Color</Label>
                      <div className="flex gap-2">
                        <Input defaultValue="#2563eb" className="flex-1" />
                        <div className="w-10 h-10 rounded-md bg-blue-600 border" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Google Font Name</Label>
                    <Input
                      value={googleFontName}
                      onChange={(e) => setGoogleFontName(e.target.value)}
                      placeholder="e.g. Inter, Roboto"
                    />
                  </div>
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                        <ChevronDown className="w-3 h-3 mr-1" />
                        Custom CSS
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Textarea
                        value={customCss}
                        onChange={(e) => setCustomCss(e.target.value)}
                        placeholder="/* Custom CSS overrides */"
                        rows={4}
                        className="font-mono text-xs mt-2"
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Advanced */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Advanced</CardTitle>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-launch</Label>
                      <p className="text-xs text-muted-foreground">Automatically open widget on page load</p>
                    </div>
                    <Switch
                      checked={autolaunchPopup}
                      onCheckedChange={setAutolaunchPopup}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Welcome Message</Label>
                    <Input
                      value={launchMessage}
                      onChange={(e) => setLaunchMessage(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Terms of Service URL</Label>
                    <Input
                      value={termsOfServiceUrl}
                      onChange={(e) => setTermsOfServiceUrl(e.target.value)}
                      placeholder="https://yourdomain.com/terms"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Privacy Policy URL</Label>
                    <Input
                      value={privacyPolicyUrl}
                      onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                      placeholder="https://yourdomain.com/privacy"
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        {/* Right Side - Live Preview */}
        <div className="col-span-2">
          <div className="sticky top-6">
            <h3 className="text-sm font-medium mb-3">Live Preview</h3>
            <div className="border rounded-xl overflow-hidden shadow-lg max-w-[320px]">
              {/* Header */}
              <div className="bg-blue-600 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      {agentImageUrl ? (
                        <img
                          src={agentImageUrl}
                          alt="Agent"
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <Bot className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{agentName || "Agent"}</h4>
                      <p className="text-xs text-white/70">Online</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white hover:bg-white/20">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Body */}
              <div className="bg-gray-50 p-6 min-h-[300px] flex flex-col items-center justify-center gap-4">
                <p className="text-sm text-center text-muted-foreground">
                  {description}
                </p>

                {/* Call button */}
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors shadow-lg">
                    <Phone className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute inset-0 rounded-full bg-blue-600/30 animate-ping" />
                </div>

                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
              </div>

              {/* Footer */}
              {branding && (
                <div className="bg-white border-t p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Powered by Invaria Labs</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
