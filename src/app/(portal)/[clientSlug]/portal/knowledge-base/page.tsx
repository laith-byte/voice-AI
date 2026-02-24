"use client";

import { useState, useEffect, useCallback } from "react";
import { BusinessInfoForm } from "@/components/knowledge-base/business-info-form";
import { HoursEditor } from "@/components/knowledge-base/hours-editor";
import { ServicesList } from "@/components/knowledge-base/services-list";
import { FaqsList } from "@/components/knowledge-base/faqs-list";
import { PoliciesList } from "@/components/knowledge-base/policies-list";
import { LocationsList } from "@/components/knowledge-base/locations-list";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Zap,
} from "lucide-react";

export default function PortalKnowledgeBasePage() {
  const [sharedSettings, setSharedSettings] = useState<Record<string, unknown> | null>(null);
  const [profileOpen, setProfileOpen] = useState(true);

  const fetchSharedSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge-base");
      if (res.ok) {
        const data = await res.json();
        setSharedSettings(data.settings ?? data);
      }
    } catch {
      // Sub-components will fetch independently as fallback
    }
  }, []);

  useEffect(() => {
    fetchSharedSettings();
  }, [fetchSharedSettings]);

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-primary/40 mb-3" />
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the information your AI agents reference when answering questions. Changes sync to all agents automatically.
          </p>
        </div>

        {/* Business Profile — auto-managed KB source */}
        <Card className="border-primary/20 bg-primary/[0.02]">
          <button
            type="button"
            className="w-full text-left"
            onClick={() => setProfileOpen(!profileOpen)}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">Business Profile</h3>
                  <Badge
                    variant="outline"
                    className="text-[10px] h-4 text-primary border-primary/30 bg-primary/5"
                  >
                    <Zap className="w-2.5 h-2.5 mr-0.5" />
                    Auto-synced
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Business info, hours, services, FAQs, policies, and locations — automatically compiled into your agents&apos; knowledge base.
                </p>
              </div>
              {profileOpen ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
            </CardContent>
          </button>

          {profileOpen && (
            <div className="px-4 pb-4 space-y-6 border-t border-primary/10 pt-4">
              <BusinessInfoForm initialSettings={sharedSettings} />
              <HoursEditor />
              <ServicesList />
              <FaqsList />
              <PoliciesList />
              <LocationsList />
            </div>
          )}
        </Card>

        {/* Info callout */}
        <div className="p-4 rounded-lg border border-muted bg-muted/30">
          <div className="flex gap-3">
            <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">
                Agent-specific sources
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You can also add custom text, URLs, or files to individual agents from their Knowledge Base tab in Agent Settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
