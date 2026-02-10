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
  BookOpen,
  HelpCircle,
  Video,
  MessageCircle,
  Calendar,
  Handshake,
  Loader2,
  Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function DashboardHomePage() {
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [domainValid, setDomainValid] = useState(false);

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

      // 3. Fetch organization custom_domain
      const { data: org } = await supabase
        .from("organizations")
        .select("custom_domain")
        .eq("id", organizationId)
        .single();

      if (org) {
        setCustomDomain(org.custom_domain ?? null);
      }

      // 4. Fetch domain_valid from whitelabel_settings
      const { data: wl } = await supabase
        .from("whitelabel_settings")
        .select("domain_valid")
        .eq("organization_id", organizationId)
        .single();

      if (wl) {
        setDomainValid(wl.domain_valid ?? false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

      {/* Cloudflare Warning */}
      {customDomain && (
        <Alert className="bg-yellow-50 text-yellow-800 border-yellow-300">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            If you&apos;re using Cloudflare, make sure to set the DNS proxy to &quot;DNS Only&quot; (gray cloud) for your custom domain to work properly.
          </AlertDescription>
        </Alert>
      )}

      {/* Resources */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="#" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Demo Hub</h3>
                  <p className="text-xs text-muted-foreground">Explore demos and examples</p>
                </div>
              </CardContent>
            </Card>
          </a>
          <a href="#" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Help Center</h3>
                  <p className="text-xs text-muted-foreground">Documentation and guides</p>
                </div>
              </CardContent>
            </Card>
          </a>
          <a href="#" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <Video className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Tutorial Videos</h3>
                  <p className="text-xs text-muted-foreground">Watch video walkthroughs</p>
                </div>
              </CardContent>
            </Card>
          </a>
        </div>
      </div>

      {/* Additional Help */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Additional Help</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Contact Support</h3>
                <p className="text-xs text-muted-foreground mt-1">Get help from our team</p>
              </div>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <a href="mailto:support@invarialabs.com">
                  Contact Us
                </a>
              </Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Schedule a Call</h3>
                <p className="text-xs text-muted-foreground mt-1">Book a 1-on-1 session</p>
              </div>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <a href="#">
                  Schedule
                </a>
              </Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center">
                <Handshake className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Partner Support</h3>
                <p className="text-xs text-muted-foreground mt-1">Partnership resources</p>
              </div>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <a href="#">
                  Learn More
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
