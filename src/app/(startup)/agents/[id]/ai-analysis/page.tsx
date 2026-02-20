"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Plus, Info, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { AiAnalysisConfig, Topic } from "@/types/database";

export default function AiAnalysisPage() {
  const params = useParams();
  const agentId = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  // Loading state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Config ID (for updates)
  const [configId, setConfigId] = useState<string | null>(null);

  // Section toggles and prompts
  const [summaryEnabled, setSummaryEnabled] = useState(true);
  const [summaryPrompt, setSummaryPrompt] = useState(
    "Provide a concise summary of the conversation, highlighting key topics discussed, decisions made, and action items."
  );

  const [evaluationEnabled, setEvaluationEnabled] = useState(true);
  const [evaluationPrompt, setEvaluationPrompt] = useState(
    "Evaluate the agent's performance on a scale of 1-10 based on helpfulness, clarity, and resolution."
  );

  const [autoTaggingEnabled, setAutoTaggingEnabled] = useState(false);
  const [autoTaggingMode, setAutoTaggingMode] = useState<"auto" | "manual">(
    "auto"
  );
  const [autoTaggingPrompt, setAutoTaggingPrompt] = useState(
    "Identify relevant tags for this conversation based on the topics discussed."
  );

  const [misunderstoodEnabled, setMisunderstoodEnabled] = useState(false);

  // Topics state
  const [topics, setTopics] = useState<Topic[]>([]);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDescription, setNewTopicDescription] = useState("");
  const [showAddTopic, setShowAddTopic] = useState(false);

  // Fetch config and topics on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Fetch ai_analysis_config
      const { data: configData, error: configError } = await supabase
        .from("ai_analysis_config")
        .select("*")
        .eq("agent_id", agentId)
        .maybeSingle();

      if (configError) {
        console.error("Error fetching ai_analysis_config:", configError);
      }

      if (configData) {
        setConfigId(configData.id);
        setSummaryEnabled(configData.summary_enabled);
        setSummaryPrompt(configData.summary_custom_prompt ?? "");
        setEvaluationEnabled(configData.evaluation_enabled);
        setEvaluationPrompt(configData.evaluation_custom_prompt ?? "");
        setAutoTaggingEnabled(configData.auto_tagging_enabled);
        setAutoTaggingMode(configData.auto_tagging_mode === "manual" ? "manual" : "auto");
        setAutoTaggingPrompt(configData.auto_tagging_custom_prompt ?? "");
        setMisunderstoodEnabled(configData.misunderstood_queries_enabled);
      } else {
        // Create default row
        const { data: newConfig, error: insertError } = await supabase
          .from("ai_analysis_config")
          .insert({
            agent_id: agentId,
            summary_enabled: true,
            summary_custom_prompt: summaryPrompt,
            evaluation_enabled: true,
            evaluation_custom_prompt: evaluationPrompt,
            auto_tagging_enabled: false,
            auto_tagging_mode: "auto",
            auto_tagging_custom_prompt: autoTaggingPrompt,
            misunderstood_queries_enabled: false,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating default ai_analysis_config:", insertError);
        } else if (newConfig) {
          setConfigId(newConfig.id);
        }
      }

      // Fetch topics
      const { data: topicsData, error: topicsError } = await supabase
        .from("topics")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: true });

      if (topicsError) {
        console.error("Error fetching topics:", topicsError);
      } else if (topicsData) {
        setTopics(topicsData as Topic[]);
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
      .from("ai_analysis_config")
      .update({
        summary_enabled: summaryEnabled,
        summary_custom_prompt: summaryPrompt || null,
        evaluation_enabled: evaluationEnabled,
        evaluation_custom_prompt: evaluationPrompt || null,
        auto_tagging_enabled: autoTaggingEnabled,
        auto_tagging_mode: autoTaggingMode,
        auto_tagging_custom_prompt: autoTaggingPrompt || null,
        misunderstood_queries_enabled: misunderstoodEnabled,
      })
      .eq("id", configId);

    if (error) {
      console.error("Error saving ai_analysis_config:", error);
      toast.error("Failed to save configuration. Please try again.");
    } else {
      toast.success("Configuration saved.");
    }

    setSaving(false);
  }, [
    configId,
    summaryEnabled,
    summaryPrompt,
    evaluationEnabled,
    evaluationPrompt,
    autoTaggingEnabled,
    autoTaggingMode,
    autoTaggingPrompt,
    misunderstoodEnabled,
    supabase,
  ]);

  async function addTopic() {
    if (!newTopicName.trim()) return;

    const { data, error } = await supabase
      .from("topics")
      .insert({
        agent_id: agentId,
        name: newTopicName.trim(),
        description: newTopicDescription.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding topic:", error);
      toast.error("Failed to add topic. Please try again.");
      return;
    }

    if (data) {
      setTopics((prev) => [...prev, data as Topic]);
      toast.success("Topic added.");
    }

    setNewTopicName("");
    setNewTopicDescription("");
    setShowAddTopic(false);
  }

  async function removeTopic(id: string) {
    const { error } = await supabase.from("topics").delete().eq("id", id);

    if (error) {
      console.error("Error removing topic:", error);
      toast.error("Failed to remove topic. Please try again.");
      return;
    }

    setTopics((prev) => prev.filter((t) => t.id !== id));
    toast.success("Topic removed.");
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function AnalysisSection({
    label,
    description,
    enabled,
    onToggle,
    children,
  }: {
    label: string;
    description: string;
    enabled: boolean;
    onToggle: (checked: boolean) => void;
    children?: React.ReactNode;
  }) {
    return (
      <div className="border border-[#e5e7eb] rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={enabled}
            onCheckedChange={onToggle}
            className="mt-0.5"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-medium text-[#111827]">{label}</h3>
            </div>
            <p className="text-xs text-[#6b7280] mb-3">{description}</p>
            {enabled && children}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6b7280]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-[#2563eb] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-[#2563eb]">
            Credit consumption notice
          </p>
          <p className="text-sm text-blue-700 mt-0.5">
            The features below consume credits. Each enabled analysis feature
            runs after every call and uses LLM tokens accordingly.
          </p>
        </div>
      </div>

      {/* 1. Summary */}
      <AnalysisSection
        label="Summary"
        description="Generate a concise summary of each call after it ends."
        enabled={summaryEnabled}
        onToggle={(checked) => setSummaryEnabled(checked as boolean)}
      >
        <div>
          <Label className="text-xs text-[#6b7280] mb-1 block">
            Custom Prompt (optional)
          </Label>
          <Textarea
            value={summaryPrompt}
            onChange={(e) => setSummaryPrompt(e.target.value)}
            rows={4}
            maxLength={5000}
            className="text-sm resize-y"
            placeholder="Enter a custom prompt for call summaries..."
          />
          <p className="text-xs text-[#6b7280] mt-1 text-right">
            {summaryPrompt.length}/5000
          </p>
        </div>
      </AnalysisSection>

      {/* 2. Evaluation */}
      <AnalysisSection
        label="Evaluation"
        description="Automatically evaluate agent performance after each call."
        enabled={evaluationEnabled}
        onToggle={(checked) => setEvaluationEnabled(checked as boolean)}
      >
        <div>
          <Label className="text-xs text-[#6b7280] mb-1 block">
            Custom Prompt (optional)
          </Label>
          <Textarea
            value={evaluationPrompt}
            onChange={(e) => setEvaluationPrompt(e.target.value)}
            rows={4}
            maxLength={5000}
            className="text-sm resize-y"
            placeholder="Enter a custom prompt for performance evaluation..."
          />
          <p className="text-xs text-[#6b7280] mt-1 text-right">
            {evaluationPrompt.length}/5000
          </p>
        </div>
      </AnalysisSection>

      {/* 3. Auto-Tagging */}
      <AnalysisSection
        label="Auto-Tagging"
        description="Automatically tag calls based on content and configured topics."
        enabled={autoTaggingEnabled}
        onToggle={(checked) => setAutoTaggingEnabled(checked as boolean)}
      >
        <div className="space-y-3">
          {/* Mode Toggle */}
          <div>
            <Label className="text-xs text-[#6b7280] mb-2 block">Mode</Label>
            <div className="inline-flex rounded-lg border border-[#e5e7eb] overflow-hidden">
              <button
                onClick={() => setAutoTaggingMode("auto")}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  autoTaggingMode === "auto"
                    ? "bg-[#2563eb] text-white"
                    : "bg-white text-[#6b7280] hover:bg-gray-50"
                }`}
              >
                Auto
              </button>
              <button
                onClick={() => setAutoTaggingMode("manual")}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  autoTaggingMode === "manual"
                    ? "bg-[#2563eb] text-white"
                    : "bg-white text-[#6b7280] hover:bg-gray-50"
                }`}
              >
                Manual
              </button>
            </div>
          </div>

          {/* Custom Prompt */}
          <div>
            <Label className="text-xs text-[#6b7280] mb-1 block">
              Custom Prompt (optional)
            </Label>
            <Textarea
              value={autoTaggingPrompt}
              onChange={(e) => setAutoTaggingPrompt(e.target.value)}
              rows={4}
              maxLength={5000}
              className="text-sm resize-y"
              placeholder="Enter a custom prompt for auto-tagging..."
            />
            <p className="text-xs text-[#6b7280] mt-1 text-right">
              {autoTaggingPrompt.length}/5000
            </p>
          </div>
        </div>
      </AnalysisSection>

      {/* 4. Misunderstood Queries */}
      <AnalysisSection
        label="Misunderstood Queries"
        description="Track queries the agent could not understand or respond to adequately."
        enabled={misunderstoodEnabled}
        onToggle={(checked) => setMisunderstoodEnabled(checked as boolean)}
      >
        <p className="text-sm text-[#6b7280]">
          When enabled, the system will analyze each call to identify moments
          where the agent misunderstood the caller or provided irrelevant
          responses. Results will be available in call logs.
        </p>
      </AnalysisSection>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={saveConfig}
          disabled={saving}
          className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>

      <Separator />

      {/* Topics Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Topics</h2>
            <p className="text-sm text-[#6b7280] mt-0.5">
              Define topics that calls can be categorized into for analysis and
              reporting.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddTopic(true)}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Topic
          </Button>
        </div>

        {/* Add Topic Form */}
        {showAddTopic && (
          <div className="border border-[#e5e7eb] rounded-lg p-4 mb-4 space-y-3">
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
                Topic Name
              </Label>
              <Input
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="e.g. Billing Question"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#111827] mb-1.5 block">
                Description (optional)
              </Label>
              <Input
                value={newTopicDescription}
                onChange={(e) => setNewTopicDescription(e.target.value)}
                placeholder="Brief description of this topic"
                className="text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={addTopic}
                size="sm"
                className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              >
                Add
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddTopic(false);
                  setNewTopicName("");
                  setNewTopicDescription("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Topics Table */}
        {topics.length > 0 ? (
          <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e5e7eb] bg-gray-50">
                  <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                    Name
                  </th>
                  <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                    Description
                  </th>
                  <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                    Created
                  </th>
                  <th className="text-right text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {topics.map((topic) => (
                  <tr key={topic.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-[#111827]">
                      {topic.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6b7280]">
                      {topic.description || "--"}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6b7280]">
                      {formatDate(topic.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => removeTopic(topic.id)}
                        className="text-[#6b7280] hover:text-red-600 transition-colors"
                        title="Delete topic"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border border-[#e5e7eb] border-dashed rounded-lg py-12 flex flex-col items-center justify-center">
            <p className="text-sm text-[#6b7280] mb-1">No topics defined yet</p>
            <p className="text-xs text-[#6b7280]">
              Add topics to categorize and analyze your calls.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
