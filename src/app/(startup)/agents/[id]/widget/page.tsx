"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Upload,
  Phone,
  RefreshCw,
  Bot,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const COLOR_PRESETS = [
  "#2563eb",
  "#1d4ed8",
  "#3b82f6",
  "#60a5fa",
  "#7c3aed",
  "#8b5cf6",
  "#a855f7",
  "#c084fc",
  "#dc2626",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#16a34a",
  "#22c55e",
  "#06b6d4",
  "#14b8a6",
];

function CollapsiblePanel({
  id,
  title,
  children,
  openPanels,
  togglePanel,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  openPanels: Record<string, boolean>;
  togglePanel: (panel: string) => void;
}) {
  const isOpen = openPanels[id];
  return (
    <Collapsible open={isOpen} onOpenChange={() => togglePanel(id)}>
      <div className="border border-[#e5e7eb] rounded-lg">
        <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-50 transition-colors">
          <span className="text-sm font-medium text-[#111827]">{title}</span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-[#6b7280]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#6b7280]" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 border-t border-[#e5e7eb] space-y-4">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function WidgetPage() {
  const params = useParams();
  const agentId = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  // Loading and saving state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Config ID (for updates)
  const [configId, setConfigId] = useState<string | null>(null);

  // Agent name for preview
  const [agentName, setAgentName] = useState("Sales Assistant");

  // General state
  const [widgetLayout, setWidgetLayout] = useState("bottom-right");
  const [description, setDescription] = useState(
    "Your AI-powered voice assistant"
  );
  const [branding, setBranding] = useState("Powered by Invaria Labs");

  // Theme state
  const [googleFontName, setGoogleFontName] = useState("Inter");
  const [selectedColor, setSelectedColor] = useState("#2563eb");
  const [customCss, setCustomCss] = useState(
    "/* Custom CSS overrides */\n.widget-container {\n  /* your styles */\n}"
  );

  // Advanced state
  const [autolaunchPopup, setAutolaunchPopup] = useState(false);
  const [launchMessage, setLaunchMessage] = useState(
    "Need help? Click to talk!"
  );
  const [launchMessageEnabled, setLaunchMessageEnabled] = useState(true);
  const [popupMessage, setPopupMessage] = useState(
    "Hi there! I can help you with any questions."
  );
  const [popupMessageEnabled, setPopupMessageEnabled] = useState(true);
  const [tosUrl, setTosUrl] = useState("");
  const [privacyUrl, setPrivacyUrl] = useState("");

  // Image URLs
  const [agentImageUrl, setAgentImageUrl] = useState("");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [launcherImageUrl, setLauncherImageUrl] = useState("");

  // Upload refs
  const agentImageInputRef = useRef<HTMLInputElement>(null);
  const backgroundImageInputRef = useRef<HTMLInputElement>(null);
  const launcherImageInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Collapsible panel states
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({
    general: true,
    theme: false,
    advanced: false,
  });

  // Fetch config and agent name on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Fetch agent name
      const { data: agentData, error: agentError } = await supabase
        .from("agents")
        .select("name")
        .eq("id", agentId)
        .maybeSingle();

      if (agentError) {
        console.error("Error fetching agent:", agentError);
      } else if (agentData) {
        setAgentName(agentData.name);
      }

      // Fetch widget_config
      const { data, error } = await supabase
        .from("widget_config")
        .select("*")
        .eq("agent_id", agentId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching widget_config:", error);
      }

      if (data) {
        setConfigId(data.id);
        setWidgetLayout(data.widget_layout);
        setDescription(data.description);
        setBranding(data.branding ?? "Powered by Invaria Labs");
        setGoogleFontName(data.google_font_name);
        setSelectedColor(data.color_preset);
        setCustomCss(data.custom_css ?? "");
        setAutolaunchPopup(data.autolaunch_popup);
        setLaunchMessage(data.launch_message);
        setLaunchMessageEnabled(data.launch_message_enabled);
        setPopupMessage(data.popup_message);
        setPopupMessageEnabled(data.popup_message_enabled);
        setTosUrl(data.terms_of_service_url ?? "");
        setPrivacyUrl(data.privacy_policy_url ?? "");
        setAgentImageUrl(data.agent_image_url ?? "");
        setBackgroundImageUrl(data.background_image_url ?? "");
        setLauncherImageUrl(data.launcher_image_url ?? "");
      } else {
        // Create default row
        const { data: newConfig, error: insertError } = await supabase
          .from("widget_config")
          .insert({
            agent_id: agentId,
            widget_layout: "bottom-right",
            description: "Your AI-powered voice assistant",
            branding: "Powered by Invaria Labs",
            google_font_name: "Inter",
            color_preset: "#2563eb",
            custom_css: "/* Custom CSS overrides */\n.widget-container {\n  /* your styles */\n}",
            autolaunch_popup: false,
            launch_message: "Need help? Click to talk!",
            launch_message_enabled: true,
            popup_message: "Hi there! I can help you with any questions.",
            popup_message_enabled: true,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating default widget_config:", insertError);
        } else if (newConfig) {
          setConfigId(newConfig.id);
        }
      }

      setLoading(false);
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Save config to Supabase
  const saveConfig = useCallback(async () => {
    if (!configId) return;
    setSaving(true);

    const { error } = await supabase
      .from("widget_config")
      .update({
        widget_layout: widgetLayout,
        description,
        branding: branding || null,
        google_font_name: googleFontName,
        color_preset: selectedColor,
        custom_css: customCss || null,
        autolaunch_popup: autolaunchPopup,
        launch_message: launchMessage,
        launch_message_enabled: launchMessageEnabled,
        popup_message: popupMessage,
        popup_message_enabled: popupMessageEnabled,
        terms_of_service_url: tosUrl || null,
        privacy_policy_url: privacyUrl || null,
        agent_image_url: agentImageUrl || null,
        background_image_url: backgroundImageUrl || null,
        launcher_image_url: launcherImageUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", configId);

    if (error) {
      console.error("Error saving widget_config:", error);
      toast.error("Failed to save widget configuration.");
    } else {
      toast.success("Widget configuration saved.");
    }

    setSaving(false);
  }, [
    configId,
    widgetLayout,
    description,
    branding,
    googleFontName,
    selectedColor,
    customCss,
    autolaunchPopup,
    launchMessage,
    launchMessageEnabled,
    popupMessage,
    popupMessageEnabled,
    tosUrl,
    privacyUrl,
    agentImageUrl,
    backgroundImageUrl,
    launcherImageUrl,
    supabase,
  ]);

  function togglePanel(panel: string) {
    setOpenPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  }

  async function handleImageUpload(
    file: File,
    field: "agent_image" | "background_image" | "launcher_image"
  ) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, etc.).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB.");
      return;
    }

    setUploadingField(field);

    const ext = file.name.split(".").pop() || "png";
    const path = `widget/${agentId}/${field}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("widget-assets")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      toast.error("Failed to upload image. Please try again.");
      setUploadingField(null);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("widget-assets")
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    if (field === "agent_image") setAgentImageUrl(publicUrl);
    else if (field === "background_image") setBackgroundImageUrl(publicUrl);
    else if (field === "launcher_image") setLauncherImageUrl(publicUrl);

    toast.success("Image uploaded. Click Save to apply changes.");
    setUploadingField(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6b7280]" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Save button */}
      <div className="absolute top-0 right-0">
        <Button
          onClick={saveConfig}
          disabled={saving}
          className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pr-0 lg:pr-24">
        {/* LEFT SIDE - Config Panels */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[#111827]">
            Widget Configuration
          </h2>

          {/* General */}
          <CollapsiblePanel openPanels={openPanels} togglePanel={togglePanel} id="general" title="General">
            {/* Agent Image Upload */}
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
                Agent Image
              </Label>
              <input
                ref={agentImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, "agent_image");
                  e.target.value = "";
                }}
              />
              {agentImageUrl ? (
                <div className="relative border border-[#e5e7eb] rounded-lg p-2 group">
                  <img
                    src={agentImageUrl}
                    alt="Agent"
                    className="w-full h-24 object-contain rounded"
                  />
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => agentImageInputRef.current?.click()}
                      className="bg-white border border-[#e5e7eb] rounded p-1 hover:bg-gray-50"
                      title="Replace image"
                    >
                      <Upload className="h-3 w-3 text-[#6b7280]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgentImageUrl("")}
                      className="bg-white border border-[#e5e7eb] rounded p-1 hover:bg-gray-50"
                      title="Remove image"
                    >
                      <X className="h-3 w-3 text-[#6b7280]" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => !uploadingField && agentImageInputRef.current?.click()}
                  className="border-2 border-dashed border-[#e5e7eb] rounded-lg p-6 flex flex-col items-center justify-center hover:border-[#2563eb] transition-colors cursor-pointer"
                >
                  {uploadingField === "agent_image" ? (
                    <Loader2 className="h-8 w-8 text-[#6b7280] mb-2 animate-spin" />
                  ) : (
                    <Upload className="h-8 w-8 text-[#6b7280] mb-2" />
                  )}
                  <p className="text-sm text-[#6b7280]">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-[#6b7280] mt-1">
                    PNG, JPG up to 2MB
                  </p>
                </div>
              )}
            </div>

            {/* Widget Layout */}
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
                Widget Layout
              </Label>
              <Select value={widgetLayout} onValueChange={setWidgetLayout}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="fullscreen">Fullscreen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
                Description
              </Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Widget description text"
                className="text-sm"
              />
            </div>

            {/* Branding */}
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
                Branding
              </Label>
              <Input
                value={branding}
                onChange={(e) => setBranding(e.target.value)}
                placeholder="Branding text shown in widget"
                className="text-sm"
              />
            </div>
          </CollapsiblePanel>

          {/* Theme */}
          <CollapsiblePanel openPanels={openPanels} togglePanel={togglePanel} id="theme" title="Theme">
            {/* Background Image */}
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
                Background Image
              </Label>
              <input
                ref={backgroundImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, "background_image");
                  e.target.value = "";
                }}
              />
              {backgroundImageUrl ? (
                <div className="relative border border-[#e5e7eb] rounded-lg p-2 group">
                  <img
                    src={backgroundImageUrl}
                    alt="Background"
                    className="w-full h-20 object-cover rounded"
                  />
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => backgroundImageInputRef.current?.click()}
                      className="bg-white border border-[#e5e7eb] rounded p-1 hover:bg-gray-50"
                      title="Replace image"
                    >
                      <Upload className="h-3 w-3 text-[#6b7280]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBackgroundImageUrl("")}
                      className="bg-white border border-[#e5e7eb] rounded p-1 hover:bg-gray-50"
                      title="Remove image"
                    >
                      <X className="h-3 w-3 text-[#6b7280]" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => !uploadingField && backgroundImageInputRef.current?.click()}
                  className="border-2 border-dashed border-[#e5e7eb] rounded-lg p-4 flex flex-col items-center justify-center hover:border-[#2563eb] transition-colors cursor-pointer"
                >
                  {uploadingField === "background_image" ? (
                    <Loader2 className="h-6 w-6 text-[#6b7280] mb-1 animate-spin" />
                  ) : (
                    <Upload className="h-6 w-6 text-[#6b7280] mb-1" />
                  )}
                  <p className="text-xs text-[#6b7280]">Upload background</p>
                </div>
              )}
            </div>

            {/* Launcher Image */}
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
                Launcher Image
              </Label>
              <input
                ref={launcherImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, "launcher_image");
                  e.target.value = "";
                }}
              />
              {launcherImageUrl ? (
                <div className="relative border border-[#e5e7eb] rounded-lg p-2 group">
                  <img
                    src={launcherImageUrl}
                    alt="Launcher"
                    className="w-full h-20 object-contain rounded"
                  />
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => launcherImageInputRef.current?.click()}
                      className="bg-white border border-[#e5e7eb] rounded p-1 hover:bg-gray-50"
                      title="Replace image"
                    >
                      <Upload className="h-3 w-3 text-[#6b7280]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLauncherImageUrl("")}
                      className="bg-white border border-[#e5e7eb] rounded p-1 hover:bg-gray-50"
                      title="Remove image"
                    >
                      <X className="h-3 w-3 text-[#6b7280]" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => !uploadingField && launcherImageInputRef.current?.click()}
                  className="border-2 border-dashed border-[#e5e7eb] rounded-lg p-4 flex flex-col items-center justify-center hover:border-[#2563eb] transition-colors cursor-pointer"
                >
                  {uploadingField === "launcher_image" ? (
                    <Loader2 className="h-6 w-6 text-[#6b7280] mb-1 animate-spin" />
                  ) : (
                    <Upload className="h-6 w-6 text-[#6b7280] mb-1" />
                  )}
                  <p className="text-xs text-[#6b7280]">Upload launcher icon</p>
                </div>
              )}
            </div>

            {/* Google Font Name */}
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
                Google Font Name
              </Label>
              <Input
                value={googleFontName}
                onChange={(e) => setGoogleFontName(e.target.value)}
                placeholder="e.g. Inter, Roboto, Open Sans"
                className="text-sm"
              />
            </div>

            {/* Color Preset Grid */}
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-2 block">
                Color Preset
              </Label>
              <div className="grid grid-cols-8 gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      selectedColor === color
                        ? "border-[#111827] scale-110 shadow-md"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Custom CSS */}
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
                Custom CSS
              </Label>
              <div className="bg-[#1e1e1e] rounded-lg p-4">
                <Textarea
                  value={customCss}
                  onChange={(e) => setCustomCss(e.target.value)}
                  rows={8}
                  className="bg-transparent text-green-400 font-mono text-sm border-none focus-visible:ring-0 resize-y placeholder:text-gray-500"
                  placeholder="/* Enter custom CSS */"
                />
              </div>
            </div>
          </CollapsiblePanel>

          {/* Advanced */}
          <CollapsiblePanel openPanels={openPanels} togglePanel={togglePanel} id="advanced" title="Advanced">
            {/* Autolaunch Popup */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="autolaunch"
                checked={autolaunchPopup}
                onCheckedChange={(checked) =>
                  setAutolaunchPopup(checked as boolean)
                }
              />
              <Label htmlFor="autolaunch" className="text-sm text-[#111827]">
                Autolaunch popup on page load
              </Label>
            </div>

            {/* Launch Message */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-sm font-medium text-[#111827]">
                  Launch Message
                </Label>
                <Switch
                  checked={launchMessageEnabled}
                  onCheckedChange={setLaunchMessageEnabled}
                />
              </div>
              {launchMessageEnabled && (
                <Input
                  value={launchMessage}
                  onChange={(e) => setLaunchMessage(e.target.value)}
                  placeholder="Message shown on widget launcher"
                  className="text-sm"
                />
              )}
            </div>

            {/* Popup Message */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-sm font-medium text-[#111827]">
                  Popup Message
                </Label>
                <Switch
                  checked={popupMessageEnabled}
                  onCheckedChange={setPopupMessageEnabled}
                />
              </div>
              {popupMessageEnabled && (
                <Input
                  value={popupMessage}
                  onChange={(e) => setPopupMessage(e.target.value)}
                  placeholder="Message shown in popup"
                  className="text-sm"
                />
              )}
            </div>

            {/* Terms of Service URL */}
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
                Terms of Service URL
              </Label>
              <Input
                value={tosUrl}
                onChange={(e) => setTosUrl(e.target.value)}
                placeholder="https://example.com/terms"
                className="text-sm"
              />
            </div>

            {/* Privacy Policy URL */}
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
                Privacy Policy URL
              </Label>
              <Input
                value={privacyUrl}
                onChange={(e) => setPrivacyUrl(e.target.value)}
                placeholder="https://example.com/privacy"
                className="text-sm"
              />
            </div>
          </CollapsiblePanel>
        </div>

        {/* RIGHT SIDE - Widget Preview */}
        <div>
          <h2 className="text-lg font-semibold text-[#111827] mb-3">
            Widget Preview
          </h2>
          <div className="border border-[#e5e7eb] rounded-xl overflow-hidden shadow-lg max-w-sm">
            {/* Blue header bar */}
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{ backgroundColor: selectedColor }}
            >
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">
                  {agentName}
                </p>
                <p className="text-white/70 text-xs">Online</p>
              </div>
            </div>

            {/* White body */}
            <div className="bg-white p-6 min-h-[240px] flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <Bot className="h-8 w-8 text-[#2563eb]" />
              </div>
              <p className="text-sm font-medium text-[#111827] text-center">
                {agentName}
              </p>
              <p className="text-xs text-[#6b7280] text-center mt-1">
                {description}
              </p>
              {branding && (
                <p className="text-[10px] text-[#6b7280] mt-4">{branding}</p>
              )}
            </div>

            {/* Bottom bar */}
            <div className="bg-gray-50 border-t border-[#e5e7eb] px-4 py-3 flex items-center justify-between">
              <button
                className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
                style={{ backgroundColor: selectedColor }}
              >
                <Phone className="h-4 w-4" />
                Start Call
              </button>
              <button className="text-[#6b7280] hover:text-[#111827] transition-colors p-2">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
