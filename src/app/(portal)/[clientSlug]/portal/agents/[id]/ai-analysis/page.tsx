"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Save, Info, Zap, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { UpgradeBanner } from "@/components/portal/upgrade-banner";

interface AiAnalysisConfig {
  id: string;
  agent_id: string;
  summary_enabled: boolean | null;
  summary_custom_prompt: string | null;
  evaluation_enabled: boolean | null;
  evaluation_custom_prompt: string | null;
  auto_tagging_enabled: boolean | null;
  auto_tagging_mode: string | null;
  auto_tagging_custom_prompt: string | null;
  misunderstood_queries_enabled: boolean | null;
}

export default function AiAnalysisPage() {
  const params = useParams();
  const agentId = params.id as string;
  const { planAccess } = usePlanAccess();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  const [summaryEnabled, setSummaryEnabled] = useState(true);
  const [evaluationEnabled, setEvaluationEnabled] = useState(true);
  const [autoTaggingEnabled, setAutoTaggingEnabled] = useState(true);
  const [misunderstoodEnabled, setMisunderstoodEnabled] = useState(false);
  const [autoTaggingMode, setAutoTaggingMode] = useState<string | null>(null);

  const [summaryPrompt, setSummaryPrompt] = useState(
    "Summarize this conversation in 2-3 sentences. Focus on the key topics discussed, the customer's main concern, and the outcome or resolution."
  );
  const [evaluationPrompt, setEvaluationPrompt] = useState(
    "Evaluate whether this conversation was successful. Consider: Was the customer's question answered? Was the issue resolved? Was an appointment booked? Rate as TRUE if the primary goal was achieved."
  );
  const [autoTaggingPrompt, setAutoTaggingPrompt] = useState(
    "Analyze the conversation and assign relevant topic tags. Consider the main subject discussed, the type of inquiry, and any specific products or services mentioned."
  );

  const loadConfig = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ai_analysis_config")
      .select("*")
      .eq("agent_id", agentId)
      .single();

    let config: AiAnalysisConfig | null = data;

    // If no config exists, create defaults
    if (!config || error) {
      const { data: newConfig, error: insertError } = await supabase
        .from("ai_analysis_config")
        .insert({ agent_id: agentId })
        .select()
        .single();

      if (insertError) {
        toast.error("Failed to initialize AI analysis config");
        setLoading(false);
        return;
      }
      config = newConfig;
    }

    if (config) {
      setConfigId(config.id);
      setSummaryEnabled(config.summary_enabled ?? true);
      setSummaryPrompt(
        config.summary_custom_prompt ??
          "Summarize this conversation in 2-3 sentences. Focus on the key topics discussed, the customer's main concern, and the outcome or resolution."
      );
      setEvaluationEnabled(config.evaluation_enabled ?? true);
      setEvaluationPrompt(
        config.evaluation_custom_prompt ??
          "Evaluate whether this conversation was successful. Consider: Was the customer's question answered? Was the issue resolved? Was an appointment booked? Rate as TRUE if the primary goal was achieved."
      );
      setAutoTaggingEnabled(config.auto_tagging_enabled ?? true);
      setAutoTaggingMode(config.auto_tagging_mode ?? null);
      setAutoTaggingPrompt(
        config.auto_tagging_custom_prompt ??
          "Analyze the conversation and assign relevant topic tags. Consider the main subject discussed, the type of inquiry, and any specific products or services mentioned."
      );
      setMisunderstoodEnabled(config.misunderstood_queries_enabled ?? false);
    }

    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    if (!configId) {
      toast.error("Config not loaded yet. Please refresh and try again.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("ai_analysis_config")
      .update({
        summary_enabled: summaryEnabled,
        summary_custom_prompt: summaryPrompt,
        evaluation_enabled: evaluationEnabled,
        evaluation_custom_prompt: evaluationPrompt,
        auto_tagging_enabled: autoTaggingEnabled,
        auto_tagging_mode: autoTaggingMode,
        auto_tagging_custom_prompt: autoTaggingPrompt,
        misunderstood_queries_enabled: misunderstoodEnabled,
      })
      .eq("id", configId);

    if (error) {
      toast.error("Failed to save AI analysis config");
    } else {
      toast.success("AI analysis config saved");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-28" />
              </div>
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Analysis</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure AI-powered conversation analysis features</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90"
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

      <div className="space-y-4">
        {/* Summary */}
        <Card className="animate-fade-in-up stagger-1 glass-card rounded-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="summary-enabled"
                  checked={summaryEnabled}
                  onCheckedChange={(checked) => setSummaryEnabled(!!checked)}
                />
                <Label htmlFor="summary-enabled" className="cursor-pointer">
                  <CardTitle className="text-base">Summary</CardTitle>
                </Label>
              </div>
            </div>
          </CardHeader>
          {summaryEnabled && (
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Custom Prompt</Label>
                  <span className="text-xs text-muted-foreground">
                    {summaryPrompt.length}/5000
                  </span>
                </div>
                <Textarea
                  value={summaryPrompt}
                  onChange={(e) => setSummaryPrompt(e.target.value.slice(0, 5000))}
                  rows={4}
                  className="font-mono text-sm focus:shadow-sm transition-shadow"
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* Evaluation */}
        {planAccess && !planAccess.ai_evaluation ? (
          <UpgradeBanner
            feature="AI Evaluation"
            plan="Professional"
            description="Automatically evaluate whether each conversation was successful."
          />
        ) : (
        <Card className="animate-fade-in-up stagger-2 glass-card rounded-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="evaluation-enabled"
                  checked={evaluationEnabled}
                  onCheckedChange={(checked) => setEvaluationEnabled(!!checked)}
                />
                <Label htmlFor="evaluation-enabled" className="cursor-pointer">
                  <CardTitle className="text-base">Evaluation</CardTitle>
                </Label>
              </div>
            </div>
          </CardHeader>
          {evaluationEnabled && (
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Custom Prompt</Label>
                  <span className="text-xs text-muted-foreground">
                    {evaluationPrompt.length}/5000
                  </span>
                </div>
                <Textarea
                  value={evaluationPrompt}
                  onChange={(e) => setEvaluationPrompt(e.target.value.slice(0, 5000))}
                  rows={4}
                  className="font-mono text-sm focus:shadow-sm transition-shadow"
                />
              </div>
            </CardContent>
          )}
        </Card>
        )}

        {/* Auto-Tagging */}
        {planAccess && !planAccess.ai_auto_tagging ? (
          <UpgradeBanner
            feature="Auto-Tagging"
            plan="Professional"
            description="Automatically tag conversations with relevant topics using AI."
          />
        ) : (
        <Card className="animate-fade-in-up stagger-3 glass-card rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="auto-tagging-enabled"
                    checked={autoTaggingEnabled}
                    onCheckedChange={(checked) => setAutoTaggingEnabled(!!checked)}
                  />
                  <Label htmlFor="auto-tagging-enabled" className="cursor-pointer">
                    <CardTitle className="text-base">Auto-Tagging</CardTitle>
                  </Label>
                </div>
              </div>
              {autoTaggingEnabled && (
                <Button variant="outline" size="sm">
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  Manual Trigger
                </Button>
              )}
            </div>
          </CardHeader>
          {autoTaggingEnabled && (
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Custom Prompt</Label>
                  <span className="text-xs text-muted-foreground">
                    {autoTaggingPrompt.length}/5000
                  </span>
                </div>
                <Textarea
                  value={autoTaggingPrompt}
                  onChange={(e) => setAutoTaggingPrompt(e.target.value.slice(0, 5000))}
                  rows={4}
                  className="font-mono text-sm focus:shadow-sm transition-shadow"
                />
              </div>
            </CardContent>
          )}
        </Card>
        )}

        {/* Misunderstood Queries */}
        {planAccess && !planAccess.ai_misunderstood ? (
          <UpgradeBanner
            feature="Misunderstood Query Detection"
            plan="Professional"
            description="Automatically detect when your agent misunderstands caller intent."
          />
        ) : (
        <Card className="animate-fade-in-up stagger-4 glass-card rounded-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="misunderstood-enabled"
                  checked={misunderstoodEnabled}
                  onCheckedChange={(checked) => setMisunderstoodEnabled(!!checked)}
                />
                <Label htmlFor="misunderstood-enabled" className="cursor-pointer">
                  <CardTitle className="text-base">Misunderstood Queries</CardTitle>
                </Label>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-[250px] text-xs">
                    When enabled, the AI will identify queries where the agent may have misunderstood the caller&apos;s intent. This helps improve agent accuracy over time.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          {misunderstoodEnabled && (
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The system will automatically flag conversations where the agent appears to have misunderstood the caller&apos;s question or intent. These will be highlighted in the Conversations view.
              </p>
            </CardContent>
          )}
        </Card>
        )}
      </div>
    </div>
  );
}
