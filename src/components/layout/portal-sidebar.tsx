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
  Palette,
  Brain,
  ArrowLeft,
  Bell,
  LogOut,
  Key,
  ChevronUp,
  Menu,
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
import { ChangePassword } from "@/components/auth/change-password";

// Map nav items to their corresponding client_access feature keys
const agentNavItems = [
  { label: "Analytics", href: "analytics", icon: BarChart3, featureKey: "analytics" },
  { label: "Conversations", href: "conversations", icon: MessageSquare, featureKey: "conversations" },
  { label: "Topics", href: "topics", icon: Tags, featureKey: "topics" },
  { label: "Leads", href: "leads", icon: UserPlus, featureKey: "leads" },
  { label: "Campaigns", href: "campaigns", icon: Megaphone, featureKey: "campaigns" },
  { label: "Agent Settings", href: "agent-settings", icon: Settings, featureKey: "agent_settings" },
  { label: "Widget", href: "widget", icon: Palette, featureKey: null },
  { label: "AI Analysis", href: "ai-analysis", icon: Brain, featureKey: null },
];

export function PortalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const agentId = params?.id as string | undefined;
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userInitials, setUserInitials] = useState("");
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

    // Fetch client_access permissions if user has a client_id
    if (userData?.client_id) {
      const { data: accessData } = await supabase
        .from("client_access")
        .select("feature, enabled")
        .eq("client_id", userData.client_id);

      if (accessData && accessData.length > 0) {
        const featureMap: Record<string, boolean> = {};
        accessData.forEach((row: { feature: string; enabled: boolean }) => {
          featureMap[row.feature] = row.enabled;
        });
        setAllowedFeatures(featureMap);
      } else {
        // No access records found -- allow everything by default
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
    // If no featureKey, always show (e.g. Widget, AI Analysis)
    if (!item.featureKey) return true;
    // If allowedFeatures hasn't loaded yet or is null (no records), show all
    if (allowedFeatures === null) return true;
    // Otherwise, only show if feature is explicitly enabled
    return allowedFeatures[item.featureKey] === true;
  });

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <Link href="/portal" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-semibold text-sm">Invaria Labs</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {isAgentView ? (
          <>
            <Link
              href="/portal"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Agents
            </Link>
            <div className="h-px bg-border my-2" />
            {filteredAgentNavItems.map((item) => {
              const href = `/portal/agents/${agentId}/${item.href}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={item.href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </>
        ) : (
          <Link
            href="/portal"
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              pathname === "/portal"
                ? "bg-blue-50 text-blue-600 font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Bot className="w-4 h-4" />
            Agents
          </Link>
        )}
      </nav>

      {/* Notification bell */}
      <div className="px-4 py-2 border-t border-border">
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full px-3 py-2 rounded-md hover:bg-accent transition-colors">
          <Bell className="w-4 h-4" />
          Notifications
          <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5 bg-blue-100 text-blue-600">
            0
          </Badge>
        </button>
      </div>

      {/* User profile */}
      <div className="p-3 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 w-full p-2 rounded-md hover:bg-accent transition-colors text-left">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-medium">
                  {userInitials || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userName || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail || ""}</p>
              </div>
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
              <Key className="w-4 h-4 mr-2" />
              Change Password
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
      <aside className="hidden md:flex w-60 h-screen border-r border-border bg-white flex-col fixed left-0 top-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile header bar - visible on mobile only */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-border flex items-center px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 rounded-md hover:bg-accent transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/portal" className="flex items-center gap-2 ml-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-semibold text-sm">Invaria Labs</span>
        </Link>
      </div>

      {/* Mobile sheet drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0" showCloseButton={false}>
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
    </>
  );
}
