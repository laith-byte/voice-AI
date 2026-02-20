"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GitBranch,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Rocket,
  X,
  GripVertical,
  Sparkles,
  UserCheck,
  Headphones,
  Phone,
  Truck,
  Calendar,
  CalendarCheck,
  Search,
  Globe,
  PhoneForwarded,
  CheckCircle2,
  Stethoscope,
  Landmark,
  ShieldCheck,
  Wrench,
  ShoppingBag,
  Plane,
  Banknote,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  type FlowNode,
  INDUSTRIES,
  makeFlowId,
  generateTemplateNodes,
} from "@/lib/conversation-flow-templates";
import { FeatureGate } from "@/components/portal/feature-gate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Flow {
  id: string;
  name: string;
  agent_id: string | null;
  nodes: FlowNode[];
  edges: unknown[];
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

interface Agent {
  id: string;
  name: string;
}

const NODE_TYPES = [
  { value: "message", label: "Message" },
  { value: "question", label: "Question" },
  { value: "condition", label: "Condition" },
  { value: "transfer", label: "Transfer" },
  { value: "end", label: "End" },
  { value: "check_availability", label: "Check Availability" },
  { value: "book_appointment", label: "Book Appointment" },
  { value: "crm_lookup", label: "CRM Lookup" },
  { value: "webhook", label: "Webhook" },
] as const;

// ---------------------------------------------------------------------------
// Flow Template Definitions (8 industries x 4 use cases = 32 templates)
// ---------------------------------------------------------------------------

interface UseCaseConfig {
  label: string;
  description: string;
  icon: typeof UserCheck;
}

const USE_CASES: Record<string, UseCaseConfig> = {
  lead_qualification: {
    label: "Lead Qualification",
    description: "Qualify inbound leads by understanding needs, budget, and timeline",
    icon: UserCheck,
  },
  customer_support: {
    label: "Customer Support",
    description: "Handle support requests, troubleshoot issues, and escalate when needed",
    icon: Headphones,
  },
  receptionist: {
    label: "Receptionist",
    description: "Greet callers, route calls, and handle appointment scheduling",
    icon: Phone,
  },
  dispatch: {
    label: "Dispatch",
    description: "Triage urgency, collect details, and dispatch field teams",
    icon: Truck,
  },
};

// ---------------------------------------------------------------------------
// Industry Color & Icon Styles
// ---------------------------------------------------------------------------

const INDUSTRY_STYLES: Record<
  string,
  {
    gradient: string;
    bg: string;
    text: string;
    border: string;
    icon: typeof Stethoscope;
  }
> = {
  healthcare: {
    gradient: "from-teal-500 to-teal-600",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-800",
    icon: Stethoscope,
  },
  financial_services: {
    gradient: "from-indigo-500 to-indigo-600",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800",
    icon: Landmark,
  },
  insurance: {
    gradient: "from-blue-500 to-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    icon: ShieldCheck,
  },
  logistics: {
    gradient: "from-amber-500 to-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    icon: Truck,
  },
  home_services: {
    gradient: "from-emerald-500 to-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: Wrench,
  },
  retail: {
    gradient: "from-purple-500 to-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
    icon: ShoppingBag,
  },
  travel_hospitality: {
    gradient: "from-rose-500 to-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
    icon: Plane,
  },
  debt_collection: {
    gradient: "from-orange-500 to-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
    icon: Banknote,
  },
};

// Node counts per use case (from generateTemplateNodes)
const USE_CASE_NODE_COUNTS: Record<string, number> = {
  lead_qualification: 10,
  customer_support: 12,
  receptionist: 11,
  dispatch: 12,
};


interface FlowTemplate {
  industryKey: string;
  useCaseKey: string;
  name: string;
  industryLabel: string;
  useCaseLabel: string;
  description: string;
}

function getAllTemplates(): FlowTemplate[] {
  const templates: FlowTemplate[] = [];
  for (const [useCaseKey, uc] of Object.entries(USE_CASES)) {
    for (const [industryKey, ind] of Object.entries(INDUSTRIES)) {
      templates.push({
        industryKey,
        useCaseKey,
        name: `${ind.label} ${uc.label}`,
        industryLabel: ind.label,
        useCaseLabel: uc.label,
        description: uc.description,
      });
    }
  }
  return templates;
}

const ALL_TEMPLATES = getAllTemplates();

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ConversationFlowsPage() {
  return (
    <FeatureGate feature="conversation_flows">
      <ConversationFlowsContent />
    </FeatureGate>
  );
}

function ConversationFlowsContent() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [templateFilter, setTemplateFilter] = useState<string>("all");

  // Editor state
  const [flowName, setFlowName] = useState("");
  const [flowAgentId, setFlowAgentId] = useState<string>("");
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const fetchFlows = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch flows from API (scoped by getClientId)
      const flowsRes = await fetch("/api/conversation-flows");
      if (flowsRes.ok) {
        const data = await flowsRes.json();
        setFlows(Array.isArray(data) ? data : []);
      } else if (flowsRes.status !== 401) {
        toast.error("Failed to load flows");
      }

      // Fetch agents scoped to the user's client
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("client_id")
          .eq("id", user.id)
          .single();

        if (userData?.client_id) {
          const { data: agentsData } = await supabase
            .from("agents")
            .select("id, name")
            .eq("client_id", userData.client_id)
            .order("created_at", { ascending: false });
          setAgents(agentsData || []);
        }
      }
    } catch {
      toast.error("Failed to load flows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  function openEditor(flow?: Flow) {
    if (flow) {
      setEditingFlow(flow);
      setFlowName(flow.name);
      setFlowAgentId(flow.agent_id || "");
      setNodes(flow.nodes || []);
      setCreating(false);
    } else {
      setEditingFlow(null);
      setFlowName("New Flow");
      setFlowAgentId("");
      setNodes([
        {
          id: makeFlowId(),
          type: "message",
          data: { text: "Hello! How can I help you today?" },
        },
      ]);
      setCreating(true);
    }
    setPromptPreview(null);
  }

  function openFromTemplate(template: FlowTemplate) {
    setEditingFlow(null);
    setFlowName(template.name);
    setFlowAgentId("");
    setNodes(generateTemplateNodes(template.industryKey, template.useCaseKey));
    setCreating(true);
    setPromptPreview(null);
  }

  function closeEditor() {
    setEditingFlow(null);
    setCreating(false);
    setPromptPreview(null);
  }

  function addNode() {
    setNodes((prev) => [
      ...prev,
      { id: makeFlowId(), type: "message", data: { text: "" } },
    ]);
  }

  function removeNode(nodeId: string) {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
  }

  function updateNode(nodeId: string, updates: Partial<FlowNode>) {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, ...updates } : n))
    );
  }

  function updateNodeData(nodeId: string, dataUpdates: Partial<FlowNode["data"]>) {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...dataUpdates } } : n
      )
    );
  }

  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(index: number) {
    const from = dragIndexRef.current;
    if (from === null || from === index) {
      dragIndexRef.current = null;
      setDragOverIndex(null);
      return;
    }
    setNodes((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  async function handleSave() {
    if (!flowName.trim()) {
      toast.error("Please enter a flow name");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      if (creating) {
        const res = await fetch("/api/conversation-flows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: flowName,
            agent_id: flowAgentId || null,
            nodes,
            edges: [],
          }),
        });
        if (!res.ok) throw new Error("Failed to create flow");
        toast.success("Flow created!");
      } else if (editingFlow) {
        const res = await fetch(`/api/conversation-flows/${editingFlow.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: flowName,
            agent_id: flowAgentId || null,
            nodes,
          }),
        });
        if (!res.ok) throw new Error("Failed to update flow");
        toast.success("Flow saved!");
      }
      closeEditor();
      fetchFlows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeploy() {
    if (!editingFlow || deploying) return;

    // Validate nodes before deploying
    const emptyWebhooks = nodes.filter((n) => n.type === "webhook" && !n.data.webhookUrl);
    const emptyTransfers = nodes.filter((n) => n.type === "transfer" && !n.data.transferNumber);
    if (emptyWebhooks.length > 0 || emptyTransfers.length > 0) {
      const warnings: string[] = [];
      if (emptyWebhooks.length > 0)
        warnings.push(`${emptyWebhooks.length} webhook node(s) missing a URL`);
      if (emptyTransfers.length > 0)
        warnings.push(`${emptyTransfers.length} transfer node(s) missing a phone number`);
      toast.warning(`Deploying with incomplete nodes: ${warnings.join(", ")}. These steps will be skipped or use fallback behavior.`);
    }

    setDeploying(true);
    try {
      const patchRes = await fetch(`/api/conversation-flows/${editingFlow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: flowName, agent_id: flowAgentId || null, nodes }),
      });
      if (!patchRes.ok) {
        toast.error("Failed to save flow changes");
        setDeploying(false);
        return;
      }

      const res = await fetch(`/api/conversation-flows/${editingFlow.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to deploy");
      }
      const data = await res.json();
      setPromptPreview(data.prompt_preview || null);
      toast.success("Flow deployed to agent!");
      fetchFlows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deploy");
    } finally {
      setDeploying(false);
    }
  }

  async function handleDelete(flowId: string) {
    if (deletingId) return;
    setDeletingId(flowId);
    const previousFlows = flows;
    setFlows((prev) => prev.filter((f) => f.id !== flowId));
    try {
      const res = await fetch(`/api/conversation-flows/${flowId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setFlows(previousFlows);
        throw new Error("Failed to delete");
      }
      toast.success("Flow deleted");
    } catch {
      toast.error("Failed to delete flow");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const isEditorOpen = creating || !!editingFlow;

  const filteredTemplates =
    templateFilter === "all"
      ? ALL_TEMPLATES
      : ALL_TEMPLATES.filter((t) => t.useCaseKey === templateFilter);

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Conversation Flows</h1>
              <p className="text-sm text-muted-foreground">
                Design and deploy structured conversation flows for your AI agents.
              </p>
            </div>
          </div>
          <Button onClick={() => openEditor()} className="gap-2">
            <Plus className="h-4 w-4" />
            Blank Flow
          </Button>
        </div>

        {/* Existing Flows */}
        {flows.length === 0 && (
          <section className="border border-dashed border-border rounded-lg py-12 flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
              <GitBranch className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold mb-1">No flows yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Create a blank flow or pick a template below to get started.
            </p>
            <Button onClick={() => openEditor()} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Blank Flow
            </Button>
          </section>
        )}
        {flows.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Your Flows ({flows.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {flows.map((flow) => {
                const agent = agents.find((a) => a.id === flow.agent_id);
                return (
                  <Card
                    key={flow.id}
                    className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => openEditor(flow)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-muted-foreground" />
                          <h3 className="font-semibold text-sm">{flow.name}</h3>
                        </div>
                        <Badge
                          variant={flow.is_active ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {flow.is_active ? "Active" : "Draft"}
                        </Badge>
                      </div>
                      {agent && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Agent: {agent.name}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {flow.nodes?.length || 0} node{(flow.nodes?.length || 0) !== 1 ? "s" : ""}
                        </span>
                        {flow.is_active ? (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Deployed v{flow.version}
                          </span>
                        ) : (
                          <span>v{flow.version}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-3 pt-3 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={(e) => { e.stopPropagation(); openEditor(flow); }}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-red-600 hover:text-red-700"
                          onClick={(e) => { e.stopPropagation(); if (window.confirm("Are you sure you want to delete this flow?")) handleDelete(flow.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Templates Section */}
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Start from a Template
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Pre-built flows for every industry and use case. Pick one and customize it.
          </p>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={templateFilter === "all" ? "default" : "outline"}
              size="sm"
              className={`h-8 text-xs ${
                templateFilter === "all"
                  ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 shadow-md shadow-violet-500/20"
                  : ""
              }`}
              onClick={() => setTemplateFilter("all")}
            >
              <Sparkles className="h-3 w-3 mr-1.5" />
              All ({ALL_TEMPLATES.length})
            </Button>
            {Object.entries(USE_CASES).map(([key, uc]) => {
              const Icon = uc.icon;
              const isActive = templateFilter === key;
              return (
                <Button
                  key={key}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={`h-8 text-xs gap-1.5 ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0 shadow-md shadow-cyan-500/20"
                      : ""
                  }`}
                  onClick={() => setTemplateFilter(key)}
                >
                  <Icon className="h-3 w-3" />
                  {uc.label}
                </Button>
              );
            })}
          </div>

          {/* Template Cards grouped by use case */}
          {templateFilter === "all" ? (
            <div className="space-y-8">
              {Object.entries(USE_CASES).map(([useCaseKey, uc]) => {
                const UseCaseIcon = uc.icon;
                const templates = ALL_TEMPLATES.filter((t) => t.useCaseKey === useCaseKey);
                return (
                  <div key={useCaseKey}>
                    {/* Use case section header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
                        <UseCaseIcon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold">{uc.label}</h3>
                        <p className="text-xs text-muted-foreground">{uc.description}</p>
                      </div>
                      <div className="hidden sm:block h-px flex-1 bg-border" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {templates.map((t, idx) => {
                        const style = INDUSTRY_STYLES[t.industryKey];
                        const IndustryIcon = style?.icon ?? GitBranch;
                        const nodeCount = USE_CASE_NODE_COUNTS[t.useCaseKey] ?? 0;
                        return (
                          <Card
                            key={`${t.industryKey}-${t.useCaseKey}`}
                            className="animate-fade-in-up overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group focus-within:ring-2 focus-within:ring-primary/50"
                            style={{ animationDelay: `${idx * 50}ms` }}
                            onClick={() => openFromTemplate(t)}
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFromTemplate(t); } }}
                          >
                            <CardContent className="p-4">
                              {/* Icon + labels */}
                              <div className="flex items-start gap-3 mb-3">
                                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${style?.gradient ?? "from-gray-500 to-gray-600"} flex items-center justify-center shadow-sm transition-transform duration-200 group-hover:scale-110 shrink-0`}>
                                  <IndustryIcon className="w-5 h-5 text-white" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm leading-tight">{t.industryLabel}</p>
                                  <Badge
                                    variant="secondary"
                                    className={`mt-1 text-[10px] px-1.5 py-0 h-5 ${style?.bg ?? ""} ${style?.text ?? ""} ${style?.border ?? ""} border`}
                                  >
                                    <UseCaseIcon className="w-3 h-3 mr-1" />
                                    {t.useCaseLabel}
                                  </Badge>
                                </div>
                              </div>
                              {/* Description */}
                              <p className="text-[11px] text-muted-foreground leading-snug mb-3">
                                {t.useCaseLabel} flow for {t.industryLabel.toLowerCase()}
                              </p>
                              {/* Bottom row */}
                              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  {nodeCount} nodes
                                </span>
                                <span className="flex items-center gap-1 text-xs font-medium text-primary">
                                  Use template
                                  <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredTemplates.map((t, idx) => {
                const style = INDUSTRY_STYLES[t.industryKey];
                const IndustryIcon = style?.icon ?? GitBranch;
                const UseCaseIcon = USE_CASES[t.useCaseKey]?.icon ?? UserCheck;
                const nodeCount = USE_CASE_NODE_COUNTS[t.useCaseKey] ?? 0;
                return (
                  <Card
                    key={`${t.industryKey}-${t.useCaseKey}`}
                    className="animate-fade-in-up overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group focus-within:ring-2 focus-within:ring-primary/50"
                    style={{ animationDelay: `${idx * 50}ms` }}
                    onClick={() => openFromTemplate(t)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFromTemplate(t); } }}
                  >
                    <CardContent className="p-4">
                      {/* Icon + labels */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${style?.gradient ?? "from-gray-500 to-gray-600"} flex items-center justify-center shadow-sm transition-transform duration-200 group-hover:scale-110 shrink-0`}>
                          <IndustryIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-tight">{t.industryLabel}</p>
                          <Badge
                            variant="secondary"
                            className={`mt-1 text-[10px] px-1.5 py-0 h-5 ${style?.bg ?? ""} ${style?.text ?? ""} ${style?.border ?? ""} border`}
                          >
                            <UseCaseIcon className="w-3 h-3 mr-1" />
                            {t.useCaseLabel}
                          </Badge>
                        </div>
                      </div>
                      {/* Description */}
                      <p className="text-[11px] text-muted-foreground leading-snug mb-3">
                        {t.useCaseLabel} flow for {t.industryLabel.toLowerCase()}
                      </p>
                      {/* Bottom row */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {nodeCount} nodes
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-primary">
                          Use template
                          <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Flow Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {creating ? "Create Flow" : `Edit: ${editingFlow?.name}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Flow Name */}
            <div className="space-y-2">
              <Label htmlFor="flow-name">Flow Name</Label>
              <Input
                id="flow-name"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                placeholder="e.g. Main Greeting Flow"
              />
            </div>

            {/* Agent Selector */}
            <div className="space-y-2">
              <Label htmlFor="flow-agent">Assign to Agent</Label>
              <Select value={flowAgentId} onValueChange={setFlowAgentId}>
                <SelectTrigger id="flow-agent">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nodes Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Nodes ({nodes.length})</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addNode}
                  className="gap-1 h-7 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Add Node
                </Button>
              </div>

              <div className="space-y-3">
                {nodes.map((node, index) => (
                  <Card
                    key={node.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={`overflow-hidden transition-all ${
                      dragOverIndex === index
                        ? "border-primary ring-1 ring-primary/30"
                        : ""
                    }`}
                  >
                    <div className="p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing" />
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {index + 1}
                        </Badge>
                        <Select
                          value={node.type}
                          onValueChange={(value) =>
                            updateNode(node.id, { type: value as FlowNode["type"] })
                          }
                        >
                          <SelectTrigger className="h-7 text-xs w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {NODE_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex-1" />
                        {nodes.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeNode(node.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {(node.type === "message" || node.type === "question") && (
                        <Textarea
                          value={node.data.text || ""}
                          onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
                          placeholder={
                            node.type === "message"
                              ? "What should the agent say?"
                              : "What question should the agent ask?"
                          }
                          className="text-sm min-h-[60px]"
                        />
                      )}

                      {node.type === "question" && (
                        <div className="space-y-2 pl-4 border-l-2 border-muted">
                          <Label className="text-xs text-muted-foreground">Response Options</Label>
                          {(node.data.options || []).map((opt, optIdx) => (
                            <div key={optIdx} className="flex gap-2">
                              <Input
                                value={opt.label}
                                onChange={(e) => {
                                  const updated = [...(node.data.options || [])];
                                  updated[optIdx] = { ...updated[optIdx], label: e.target.value };
                                  updateNodeData(node.id, { options: updated });
                                }}
                                placeholder={`Option ${optIdx + 1}`}
                                className="text-xs h-7"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => {
                                  const updated = (node.data.options || []).filter((_, i) => i !== optIdx);
                                  updateNodeData(node.id, { options: updated });
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => {
                              const updated = [...(node.data.options || []), { label: "", nextNodeId: "" }];
                              updateNodeData(node.id, { options: updated });
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Option
                          </Button>
                        </div>
                      )}

                      {node.type === "condition" && (
                        <Input
                          value={node.data.condition || ""}
                          onChange={(e) => updateNodeData(node.id, { condition: e.target.value })}
                          placeholder="e.g. caller wants to schedule an appointment"
                          className="text-sm"
                        />
                      )}

                      {node.type === "transfer" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <PhoneForwarded className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-xs text-muted-foreground">Seamless call transfer via warm handoff</span>
                          </div>
                          <Textarea
                            value={node.data.text || ""}
                            onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
                            placeholder="What should the agent say before transferring? (optional)"
                            className="text-sm min-h-[40px]"
                          />
                          <Input
                            value={node.data.transferNumber || ""}
                            onChange={(e) => updateNodeData(node.id, { transferNumber: e.target.value })}
                            placeholder="Transfer phone number, e.g. +15551234567"
                            className="text-sm"
                          />
                        </div>
                      )}

                      {node.type === "end" && (
                        <Textarea
                          value={node.data.text || ""}
                          onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
                          placeholder="How should the agent end the conversation?"
                          className="text-sm min-h-[40px]"
                        />
                      )}

                      {(node.type === "check_availability" || node.type === "book_appointment") && (
                        <div className="space-y-2">
                          <Textarea
                            value={node.data.text || ""}
                            onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
                            placeholder={
                              node.type === "check_availability"
                                ? "What should the agent say when checking availability?"
                                : "What should the agent say when booking?"
                            }
                            className="text-sm min-h-[40px]"
                          />
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              {node.type === "check_availability" ? (
                                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                              ) : (
                                <CalendarCheck className="h-3.5 w-3.5 text-green-500" />
                              )}
                              <Label className="text-xs">Calendar Provider</Label>
                            </div>
                            <Select
                              value={node.data.provider || "google"}
                              onValueChange={(value) =>
                                updateNodeData(node.id, { provider: value as "google" | "calendly" })
                              }
                            >
                              <SelectTrigger className="h-7 text-xs w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="google">Google Calendar</SelectItem>
                                <SelectItem value="calendly">Calendly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {node.type === "crm_lookup" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Search className="h-3.5 w-3.5 text-orange-500" />
                            <span className="text-xs text-muted-foreground">Looks up the caller in HubSpot by phone number</span>
                          </div>
                          <Textarea
                            value={node.data.text || ""}
                            onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
                            placeholder="Instructions for what the agent should do with the lookup results"
                            className="text-sm min-h-[40px]"
                          />
                        </div>
                      )}

                      {node.type === "webhook" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Globe className="h-3.5 w-3.5 text-purple-500" />
                            <span className="text-xs text-muted-foreground">Sends call data to an external endpoint</span>
                          </div>
                          <Textarea
                            value={node.data.text || ""}
                            onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
                            placeholder="What data should the agent collect and send?"
                            className="text-sm min-h-[40px]"
                          />
                          <Input
                            value={node.data.webhookUrl || ""}
                            onChange={(e) => updateNodeData(node.id, { webhookUrl: e.target.value })}
                            placeholder="https://your-webhook-url.com/endpoint"
                            className="text-sm"
                          />
                          <Select
                            value={node.data.webhookMethod || "POST"}
                            onValueChange={(value) =>
                              updateNodeData(node.id, { webhookMethod: value as "POST" | "GET" })
                            }
                          >
                            <SelectTrigger className="h-7 text-xs w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="POST">POST</SelectItem>
                              <SelectItem value="GET">GET</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Prompt Preview */}
            {promptPreview && (
              <div className="space-y-2">
                <Label>Deployed Prompt Preview</Label>
                <pre className="bg-muted rounded-lg p-3 text-xs whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                  {promptPreview}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {creating ? "Create Flow" : "Save Changes"}
              </Button>
              {!creating && editingFlow && flowAgentId && (
                <Button
                  variant="outline"
                  onClick={handleDeploy}
                  disabled={deploying}
                  className="gap-2"
                >
                  {deploying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  Deploy to Agent
                </Button>
              )}
              <Button variant="ghost" onClick={closeEditor}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
