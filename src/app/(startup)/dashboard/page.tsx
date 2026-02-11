"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Globe,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Loader2,
  Settings,
  CheckCircle2,
  Circle,
  Users,
  Bot,
  PhoneCall,
  Clock,
  UserPlus,
  BarChart3,
  Receipt,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SetupStep {
  label: string;
  href: string;
  complete: boolean;
}

export default function DashboardHomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [domainValid, setDomainValid] = useState(false);

  // KPI state
  const [totalClients, setTotalClients] = useState(0);
  const [totalAgents, setTotalAgents] = useState(0);
  const [totalCalls, setTotalCalls] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);

  // Setup checklist state
  const [retellConnected, setRetellConnected] = useState(false);
  const [hasAgents, setHasAgents] = useState(false);
  const [hasClients, setHasClients] = useState(false);
  const [hasDomain, setHasDomain] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    setError(false);
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

      const orgId = userData.organization_id;

      // Run all queries in parallel
      const [
        orgResult,
        whitelabelResult,
        agentsResult,
        clientsResult,
        callLogsResult,
        integrationsResult,
        stripeResult,
      ] = await Promise.all([
        // Organization custom_domain
        supabase
          .from("organizations")
          .select("custom_domain")
          .eq("id", orgId)
          .single(),
        // Whitelabel settings
        supabase
          .from("whitelabel_settings")
          .select("domain_valid, custom_domain")
          .eq("organization_id", orgId)
          .single(),
        // Agents count
        supabase
          .from("agents")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId),
        // Clients count
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId),
        // Call logs (duration_seconds for total minutes + count)
        supabase
          .from("call_logs")
          .select("duration_seconds")
          .eq("organization_id", orgId),
        // Retell integration check
        supabase
          .from("integrations")
          .select("id")
          .eq("organization_id", orgId)
          .eq("provider", "retell")
          .eq("is_connected", true)
          .limit(1),
        // Stripe connection check
        supabase
          .from("stripe_connections")
          .select("id")
          .eq("organization_id", orgId)
          .limit(1),
      ]);

      // Domain
      if (orgResult.data) {
        setCustomDomain(orgResult.data.custom_domain ?? null);
      }
      if (whitelabelResult.data) {
        setDomainValid(whitelabelResult.data.domain_valid ?? false);
        setHasDomain(!!whitelabelResult.data.custom_domain);
      }

      // KPIs
      const agentCount = agentsResult.count ?? 0;
      const clientCount = clientsResult.count ?? 0;
      setTotalAgents(agentCount);
      setTotalClients(clientCount);

      if (callLogsResult.data) {
        setTotalCalls(callLogsResult.data.length);
        const totalSec = callLogsResult.data.reduce(
          (sum, log) => sum + (log.duration_seconds ?? 0),
          0
        );
        setTotalMinutes(Math.round((totalSec / 60) * 100) / 100);
      }

      // Setup checklist
      setHasAgents(agentCount > 0);
      setHasClients(clientCount > 0);
      setRetellConnected((integrationsResult.data?.length ?? 0) > 0);
      setStripeConnected((stripeResult.data?.length ?? 0) > 0);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setupSteps: SetupStep[] = [
    { label: "Connect Retell integration", href: "/settings/integrations", complete: retellConnected },
    { label: "Add your first agent", href: "/agents", complete: hasAgents },
    { label: "Add your first client", href: "/clients", complete: hasClients },
    { label: "Set up custom domain", href: "/settings/whitelabel", complete: hasDomain },
    { label: "Connect Stripe", href: "/billing/connect", complete: stripeConnected },
  ];

  const completedCount = setupSteps.filter((s) => s.complete).length;
  const allComplete = completedCount === setupSteps.length;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-[#6b7280]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Home</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome to your Invaria Labs dashboard</p>
      </div>

      {/* Setup Checklist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Getting Started</CardTitle>
                <CardDescription className="text-sm">
                  {allComplete
                    ? "You're all set!"
                    : `${completedCount}/${setupSteps.length} steps complete`}
                </CardDescription>
              </div>
            </div>
            {allComplete && (
              <Badge className="bg-green-50 text-green-700 border-green-200">
                Setup Complete
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-100 rounded-full mb-4">
            <div
              className="h-2 bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / setupSteps.length) * 100}%` }}
            />
          </div>

          {!allComplete && (
            <div className="space-y-2">
              {setupSteps.map((step) => (
                <div key={step.label} className="flex items-center gap-3">
                  {step.complete ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 shrink-0" />
                  )}
                  {step.complete ? (
                    <span className="text-sm text-muted-foreground line-through">{step.label}</span>
                  ) : (
                    <Link
                      href={step.href}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {step.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {error ? (
        <div className="border border-red-200 bg-red-50 rounded-lg p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">Failed to load dashboard data</p>
              <p className="text-xs text-red-600 mt-0.5">Please check your connection and try again.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            Retry
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-[#6b7280]">Total Clients</p>
                  <p className="text-xl font-semibold text-[#111827]">
                    {totalClients.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-[#6b7280]">Total Agents</p>
                  <p className="text-xl font-semibold text-[#111827]">
                    {totalAgents.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <PhoneCall className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-[#6b7280]">Total Calls</p>
                  <p className="text-xl font-semibold text-[#111827]">
                    {totalCalls.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-[#6b7280]">Total Minutes</p>
                  <p className="text-xl font-semibold text-[#111827]">
                    {totalMinutes.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions + Domain */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Domain Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Custom Domain</CardTitle>
                  <CardDescription className="text-sm">
                    {customDomain ?? "No custom domain configured"}
                  </CardDescription>
                </div>
              </div>
              {customDomain && (
                <Badge
                  variant="secondary"
                  className={
                    domainValid
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }
                >
                  {domainValid ? "Active" : "Inactive"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {customDomain ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`https://${customDomain}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Visit
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Remove
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/whitelabel">
                  <Settings className="w-3.5 h-3.5 mr-1.5" />
                  Set Up Domain
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription className="text-sm">Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="justify-start" asChild>
                <Link href="/clients">
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Add Client
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="justify-start" asChild>
                <Link href="/agents">
                  <Bot className="w-3.5 h-3.5 mr-1.5" />
                  Add Agent
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="justify-start" asChild>
                <Link href="/settings/usage">
                  <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                  View Usage
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="justify-start" asChild>
                <Link href="/billing">
                  <Receipt className="w-3.5 h-3.5 mr-1.5" />
                  Manage Billing
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cloudflare Warning */}
      {customDomain && (
        <Alert className="bg-yellow-50 text-yellow-800 border-yellow-300">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            If you&apos;re using Cloudflare, make sure to set the DNS proxy to &quot;DNS Only&quot; (gray cloud) for your custom domain to work properly.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
