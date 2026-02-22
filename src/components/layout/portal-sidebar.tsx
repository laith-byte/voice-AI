"use client";

import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Bot,
  BarChart3,
  MessageSquare,
  Tags,
  UserPlus,
  Megaphone,
  Settings,
  ArrowLeft,
  Bell,
  LogOut,
  Key,
  ChevronUp,
  Menu,
  HelpCircle,
  Palette,
  Building2,
  CreditCard,
  Sparkles,
  BookOpen,
  GitBranch,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ChangePassword } from "@/components/auth/change-password";
import { useOnboardingContext } from "@/components/onboarding/onboarding-provider";
import { useDashboardTheme } from "@/components/portal/dashboard-theme-provider";
import { cn } from "@/lib/utils";

const colorPresets = [
  { name: "Blue", value: "#2563eb" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Emerald", value: "#059669" },
  { name: "Rose", value: "#e11d48" },
  { name: "Orange", value: "#ea580c" },
  { name: "Slate", value: "#475569" },
];

// Map nav items to their corresponding client_access feature keys
const agentNavItems = [
  { label: "Analytics", href: "analytics", icon: BarChart3, featureKey: "analytics" },
  { label: "Conversations", href: "conversations", icon: MessageSquare, featureKey: "conversations" },
  { label: "Topics", href: "topics", icon: Tags, featureKey: "topics" },
  { label: "Knowledge Base", href: "knowledge-base", icon: BookOpen, featureKey: "knowledge_base" },
  { label: "Leads", href: "leads", icon: UserPlus, featureKey: "leads" },
  { label: "Campaigns", href: "campaigns", icon: Megaphone, featureKey: "campaigns" },
  { label: "Agent Settings", href: "agent-settings", icon: Settings, featureKey: "agent_settings" },
];

export function PortalSidebar({ clientSlug }: { clientSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const agentId = params?.id as string | undefined;
  const { retriggerTutorial } = useOnboardingContext();
  const { color: dashboardColor, setColor, saveColor } = useDashboardTheme();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [clientName, setClientName] = useState("");
  const [allowedFeatures, setAllowedFeatures] = useState<Record<string, boolean> | null>(null);

  const isAgentView = !!agentId;

  const fetchUser = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: userData } = await supabase
      .from("users")
      .select("name, email, client_id")
      .eq("id", user.id)
      .single();

    const name = userData?.name || "";
    const email = userData?.email || user.email || "";

    setUserName(name);
    setUserEmail(email);

    // Generate initials from name, or fall back to email
    if (name) {
      const parts = name.trim().split(/\s+/);
      const initials = parts
        .slice(0, 2)
        .map((p: string) => p[0]?.toUpperCase() ?? "")
        .join("");
      setUserInitials(initials || "U");
    } else if (email) {
      setUserInitials(email[0].toUpperCase());
    } else {
      setUserInitials("U");
    }

    // Fetch client name and access permissions if user has a client_id
    if (userData?.client_id) {
      const { data: clientData } = await supabase
        .from("clients")
        .select("name")
        .eq("id", userData.client_id)
        .single();

      if (clientData?.name) {
        setClientName(clientData.name);
      }

      // 1. Check client_access first (admin overrides)
      const { data: accessData } = await supabase
        .from("client_access")
        .select("feature, enabled")
        .eq("client_id", userData.client_id);

      const featureMap: Record<string, boolean> = {};
      if (accessData && accessData.length > 0) {
        accessData.forEach((row: { feature: string; enabled: boolean }) => {
          featureMap[row.feature] = row.enabled;
        });
      }

      // 2. Fall back to plan columns for features without client_access records
      try {
        const res = await fetch("/api/client/plan-access");
        if (res.ok) {
          const planAccess = await res.json();
          // Map plan columns to feature keys (only if no client_access override)
          const planFeatureMap: Record<string, boolean> = {
            // Base features — always enabled
            analytics: true,
            conversations: true,
            leads: true,
            phone_numbers: true,
            workflows: true,
            knowledge_base: true,
            // Plan-gated features
            topics: planAccess.topic_management ?? true,
            campaigns: planAccess.campaign_outbound ?? true,
            agent_settings: (planAccess.raw_prompt_editor || planAccess.speech_settings_full) ?? true,
            conversation_flows: planAccess.conversation_flows ?? false,
          };

          for (const [feature, enabled] of Object.entries(planFeatureMap)) {
            if (!(feature in featureMap)) {
              featureMap[feature] = enabled;
            }
          }
        }
      } catch {
        // Fall through — use client_access only
      }

      if (Object.keys(featureMap).length > 0) {
        setAllowedFeatures(featureMap);
      } else {
        setAllowedFeatures(null);
      }
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Close mobile sheet on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  // Filter agent nav items based on client_access permissions
  const filteredAgentNavItems = agentNavItems.filter((item) => {
    // If no featureKey, always show
    if (!item.featureKey) return true;
    // If allowedFeatures hasn't loaded yet or is null (no records), show all
    if (allowedFeatures === null) return true;
    // Otherwise, only show if feature is explicitly enabled
    return allowedFeatures[item.featureKey] === true;
  });

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-5">
        <Link href={`/${clientSlug}/portal`} className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center" style={{ boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)' }}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-semibold text-sm text-white">{clientName || "Invaria Labs"}</span>
        </Link>
        <div className="mt-4 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)' }} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-1 px-3 space-y-0.5 overflow-y-auto">
        {isAgentView ? (
          <>
            <Link
              href={`/${clientSlug}/portal`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 transition-all duration-200 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Agents
            </Link>
            <div className="h-px my-2" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)' }} />
            {filteredAgentNavItems.map((item) => {
              const href = `/${clientSlug}/portal/agents/${agentId}/${item.href}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={item.href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-white/10 text-white font-medium"
                      : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                  }`}
                  style={isActive ? { boxShadow: 'inset 3px 0 0 0 var(--primary, #2563eb)' } : undefined}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </>
        ) : (
          <>
            <Link
              href={`/${clientSlug}/portal`}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                pathname === `/${clientSlug}/portal`
                  ? "bg-white/10 text-white font-medium"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              }`}
              style={pathname === `/${clientSlug}/portal` ? { boxShadow: 'inset 3px 0 0 0 var(--primary, #2563eb)' } : undefined}
            >
              <Bot className="w-4 h-4" />
              Agents
            </Link>
            {(allowedFeatures === null || allowedFeatures["conversation_flows"] !== false) && (
              <Link
                href={`/${clientSlug}/portal/conversation-flows`}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  pathname === `/${clientSlug}/portal/conversation-flows`
                    ? "bg-white/10 text-white font-medium"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                }`}
                style={pathname === `/${clientSlug}/portal/conversation-flows` ? { boxShadow: 'inset 3px 0 0 0 var(--primary, #2563eb)' } : undefined}
              >
                <GitBranch className="w-4 h-4" />
                Flows
              </Link>
            )}
            <Link
              href={`/${clientSlug}/portal/automations`}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                pathname === `/${clientSlug}/portal/automations`
                  ? "bg-white/10 text-white font-medium"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              }`}
              style={pathname === `/${clientSlug}/portal/automations` ? { boxShadow: 'inset 3px 0 0 0 var(--primary, #2563eb)' } : undefined}
            >
              <Sparkles className="w-4 h-4" />
              Automations
            </Link>
            <Link
              href={`/${clientSlug}/portal/settings/business`}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                pathname === `/${clientSlug}/portal/settings/business`
                  ? "bg-white/10 text-white font-medium"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              }`}
              style={pathname === `/${clientSlug}/portal/settings/business` ? { boxShadow: 'inset 3px 0 0 0 var(--primary, #2563eb)' } : undefined}
            >
              <Building2 className="w-4 h-4" />
              Business Settings
            </Link>
            <Link
              href={`/${clientSlug}/portal/billing`}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                pathname === `/${clientSlug}/portal/billing`
                  ? "bg-white/10 text-white font-medium"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              }`}
              style={pathname === `/${clientSlug}/portal/billing` ? { boxShadow: 'inset 3px 0 0 0 var(--primary, #2563eb)' } : undefined}
            >
              <CreditCard className="w-4 h-4" />
              Billing
            </Link>
          </>
        )}
      </nav>

      {/* Notification bell */}
      <div className="px-4 py-2 border-t border-white/[0.06]">
        <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 w-full px-3 py-2 rounded-lg hover:bg-white/[0.06] transition-all duration-200">
          <Bell className="w-4 h-4" />
          Notifications
          <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5 bg-primary/20 text-primary-foreground font-medium">
            0
          </Badge>
        </button>
      </div>

      {/* User profile */}
      <div className="p-3 border-t border-white/[0.06]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-white/[0.06] transition-all duration-200 text-left group">
              <Avatar className="w-8 h-8 ring-2 ring-transparent group-hover:ring-primary/20 transition-all duration-200">
                <AvatarFallback className="bg-primary/20 text-primary-foreground text-xs font-medium">
                  {userInitials || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-tight text-white">{userName || "User"}</p>
                <p className="text-xs text-slate-500 truncate leading-tight mt-0.5">{userEmail || ""}</p>
              </div>
              <ChevronUp className="w-4 h-4 text-slate-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
              <Key className="w-4 h-4 mr-2" />
              Change Password
            </DropdownMenuItem>
            <DropdownMenuItem onClick={retriggerTutorial}>
              <HelpCircle className="w-4 h-4 mr-2" />
              Take a Tour
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setColorPickerOpen(true)}>
              <Palette className="w-4 h-4 mr-2" />
              Dashboard Color
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="w-4 h-4 mr-2" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar - hidden on mobile */}
      <aside className="hidden md:flex w-60 h-screen sidebar-colored flex-col fixed left-0 top-0 z-40" style={{ boxShadow: '1px 0 0 0 rgba(255,255,255,0.05)' }}>
        {sidebarContent}
      </aside>

      {/* Mobile header bar - visible on mobile only */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 border-b border-white/[0.06] flex items-center px-4" style={{ backgroundColor: 'var(--sidebar-bg-start)' }}>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-white/[0.06] text-white transition-all duration-200"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href={`/${clientSlug}/portal`} className="flex items-center gap-2 ml-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center" style={{ boxShadow: '0 1px 4px rgba(37, 99, 235, 0.2)' }}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-semibold text-sm text-white">{clientName || "Invaria Labs"}</span>
        </Link>
      </div>

      {/* Mobile sheet drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0 !border-r-white/[0.06]" style={{ backgroundColor: 'var(--sidebar-bg-start)' }} showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <div className="flex flex-col h-full">
            {sidebarContent}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <ChangePassword onClose={() => setChangePasswordOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dashboard Color</DialogTitle>
            <p className="text-sm text-muted-foreground">Applies to your entire portal</p>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap gap-2.5">
              {colorPresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => saveColor(preset.value)}
                  className={cn(
                    "w-9 h-9 rounded-full border-2 transition-all hover:scale-110",
                    dashboardColor === preset.value
                      ? "border-foreground scale-110 shadow-md"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: preset.value }}
                  title={preset.name}
                />
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <Input
                value={dashboardColor}
                onChange={(e) => setColor(e.target.value)}
                onBlur={() => saveColor(dashboardColor)}
                className="text-sm font-mono h-9 flex-1"
                placeholder="#2563eb"
              />
              <div
                className="w-9 h-9 rounded-md border shrink-0"
                style={{ backgroundColor: dashboardColor }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
