"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  MessageSquare,
  HelpCircle,
  XCircle,
  Car,
  Hotel,
  Scale,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import {
  type FlowNode,
  INDUSTRIES,
  AGENT_NAMES,
  makeFlowId,
  generateTemplateNodes,
  replaceFlowPlaceholders,
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
  conversation_flow_id?: string | null;
}

interface DeployedAgentFlow {
  agentId: string;
  agentName: string;
  engineType: string;
  nodes: Array<{ id: string; name: string; text: string }>;
  nodeCount: number;
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
  home_services: {
    gradient: "from-emerald-500 to-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: Wrench,
  },
  automotive: {
    gradient: "from-slate-500 to-slate-600",
    bg: "bg-slate-50 dark:bg-slate-950/30",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-800",
    icon: Car,
  },
  hospitality: {
    gradient: "from-pink-500 to-pink-600",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    text: "text-pink-700 dark:text-pink-300",
    border: "border-pink-200 dark:border-pink-800",
    icon: Hotel,
  },
  legal: {
    gradient: "from-sky-500 to-sky-600",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-200 dark:border-sky-800",
    icon: Scale,
  },
  real_estate: {
    gradient: "from-lime-500 to-lime-600",
    bg: "bg-lime-50 dark:bg-lime-950/30",
    text: "text-lime-700 dark:text-lime-300",
    border: "border-lime-200 dark:border-lime-800",
    icon: Home,
  },
};

// Node counts per use case (from generateTemplateNodes)
const USE_CASE_NODE_COUNTS: Record<string, number> = {
  lead_qualification: 10,
  customer_support: 12,
  receptionist: 11,
  dispatch: 12,
};


// ---------------------------------------------------------------------------
// Node type icons & colors for the active flow preview
// ---------------------------------------------------------------------------

const NODE_TYPE_DISPLAY: Record<
  string,
  { icon: typeof MessageSquare; color: string; dot: string }
> = {
  message: { icon: MessageSquare, color: "text-blue-500", dot: "bg-blue-500" },
  question: { icon: HelpCircle, color: "text-indigo-500", dot: "bg-indigo-500" },
  condition: { icon: GitBranch, color: "text-amber-500", dot: "bg-amber-500" },
  transfer: { icon: PhoneForwarded, color: "text-orange-500", dot: "bg-orange-500" },
  end: { icon: XCircle, color: "text-red-500", dot: "bg-red-500" },
  check_availability: { icon: Calendar, color: "text-teal-500", dot: "bg-teal-500" },
  book_appointment: { icon: CalendarCheck, color: "text-green-500", dot: "bg-green-500" },
  crm_lookup: { icon: Search, color: "text-orange-500", dot: "bg-orange-500" },
  webhook: { icon: Globe, color: "text-purple-500", dot: "bg-purple-500" },
};

// ---------------------------------------------------------------------------
// Active Flow Preview — vertical step timeline
// ---------------------------------------------------------------------------

function ActiveFlowPreview({ nodes }: { nodes: FlowNode[] }) {
  const MAX_VISIBLE = 6;
  const visible = nodes.slice(0, MAX_VISIBLE);
  const remaining = nodes.length - MAX_VISIBLE;

  function getNodeLabel(node: FlowNode) {
    const entry = NODE_TYPES.find((t) => t.value === node.type);
    return entry?.label ?? node.type;
  }

  function getPreviewText(node: FlowNode) {
    const text =
      node.data.text ||
      node.data.condition ||
      node.data.transferNumber ||
      node.data.webhookUrl ||
      "";
    return text.length > 60 ? text.slice(0, 60) + "..." : text;
  }

  return (
    <div className="relative flex flex-col gap-0 max-h-[320px] overflow-y-auto pr-2">
      {visible.map((node, idx) => {
        const display = NODE_TYPE_DISPLAY[node.type] ?? {
          icon: GitBranch,
          color: "text-muted-foreground",
          dot: "bg-muted-foreground",
        };
        const Icon = display.icon;
        const preview = getPreviewText(node);

        return (
          <div key={node.id} className="flex items-start gap-3 relative">
            {/* Vertical line */}
            <div className="flex flex-col items-center">
              <div className={`h-3 w-3 rounded-full ${display.dot} shrink-0 mt-0.5 ring-2 ring-background`} />
              {idx < visible.length - 1 && (
                <div className="w-px flex-1 min-h-[28px] bg-border" />
              )}
              {idx === visible.length - 1 && remaining > 0 && (
                <div className="w-px flex-1 min-h-[28px] bg-border" />
              )}
            </div>

            {/* Step content */}
            <div className="pb-4 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-muted-foreground">{idx + 1}.</span>
                <Icon className={`h-3.5 w-3.5 ${display.color} shrink-0`} />
                <span className="text-xs font-medium">{getNodeLabel(node)}</span>
              </div>
              {preview && (
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 truncate max-w-[240px]">
                  {preview}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {remaining > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="h-3 w-3 rounded-full bg-muted-foreground/30 shrink-0 ring-2 ring-background" />
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">
            +{remaining} more step{remaining !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

function DeployedFlowPreview({ nodes }: { nodes: Array<{ id: string; name: string; text: string }> }) {
  const MAX_VISIBLE = 6;
  const visible = nodes.slice(0, MAX_VISIBLE);
  const remaining = nodes.length - MAX_VISIBLE;

  return (
    <div className="relative flex flex-col gap-0 max-h-[320px] overflow-y-auto pr-2">
      {visible.map((node, idx) => (
        <div key={node.id} className="flex items-start gap-3 relative">
          <div className="flex flex-col items-center">
            <div className="h-3 w-3 rounded-full bg-blue-500 shrink-0 mt-0.5 ring-2 ring-background" />
            {idx < visible.length - 1 && (
              <div className="w-px flex-1 min-h-[28px] bg-border" />
            )}
            {idx === visible.length - 1 && remaining > 0 && (
              <div className="w-px flex-1 min-h-[28px] bg-border" />
            )}
          </div>
          <div className="pb-4 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-muted-foreground">{idx + 1}.</span>
              <MessageSquare className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="text-xs font-medium">{node.name}</span>
            </div>
            {node.text && (
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 truncate max-w-[240px]">
                {node.text.length > 60 ? node.text.slice(0, 60) + "..." : node.text}
              </p>
            )}
          </div>
        </div>
      ))}

      {remaining > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="h-3 w-3 rounded-full bg-muted-foreground/30 shrink-0 ring-2 ring-background" />
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">
            +{remaining} more step{remaining !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

interface FlowTemplate {
  industryKey: string;
  useCaseKey: string;
  name: string;
  industryLabel: string;
  useCaseLabel: string;
  description: string;
  nodeCount: number;
  defaultFlowNodes: FlowNode[] | null;
}

function getCodeTemplates(): FlowTemplate[] {
  const templates: FlowTemplate[] = [];
  for (const [useCaseKey, uc] of Object.entries(USE_CASES)) {
    for (const [industryKey, ind] of Object.entries(INDUSTRIES)) {
      const nodes = generateTemplateNodes(industryKey, useCaseKey);
      templates.push({
        industryKey,
        useCaseKey,
        name: `${ind.label} ${uc.label}`,
        industryLabel: ind.label,
        useCaseLabel: uc.label,
        description: uc.description,
        nodeCount: nodes.length,
        defaultFlowNodes: null,
      });
    }
  }
  return templates;
}

// Static fallback used until DB templates are loaded
const CODE_TEMPLATES = getCodeTemplates();

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
  const params = useParams<{ clientSlug: string }>();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [deployedAgentFlow, setDeployedAgentFlow] = useState<DeployedAgentFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [flowToDelete, setFlowToDelete] = useState<string | null>(null);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [confirmDeploy, setConfirmDeploy] = useState(false);
  const [allTemplates, setAllTemplates] = useState<FlowTemplate[]>(CODE_TEMPLATES);

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
      let fetchedFlows: Flow[] = [];
      const flowsRes = await fetch("/api/conversation-flows");
      if (flowsRes.ok) {
        const data = await flowsRes.json();
        fetchedFlows = Array.isArray(data) ? data : [];
        setFlows(fetchedFlows);
      } else if (flowsRes.status !== 401) {
        toast.error("Failed to load flows");
      }

      // Agents fetched via Supabase client with RLS — no dedicated client-facing API endpoint
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
            .select("id, name, conversation_flow_id")
            .eq("client_id", userData.client_id)
            .order("created_at", { ascending: false });
          setAgents(agentsData || []);

          // Discover deployed flows on agents (Prompt Tree → Retell)
          // that aren't already tracked in the conversation_flows table
          const dbActiveAgentIds = new Set(
            fetchedFlows.filter((f) => f.is_active && f.agent_id).map((f) => f.agent_id)
          );

          let foundDeployed: DeployedAgentFlow | null = null;
          for (const agent of agentsData || []) {
            if (dbActiveAgentIds.has(agent.id)) continue;
            try {
              const cfRes = await fetch(`/api/agents/${agent.id}/conversation-flow`);
              if (!cfRes.ok) {
                continue;
              }
              const cfData = await cfRes.json();
              if (cfData.exists && cfData.flow?.nodes?.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const retellNodes = (cfData.flow.nodes as any[]) || [];
                foundDeployed = {
                  agentId: agent.id,
                  agentName: agent.name,
                  engineType: cfData.engine_type || "unknown",
                  nodes: retellNodes.map((n) => ({
                    id: n.id || n.name || "",
                    name: n.name || n.id || "",
                    text: n.instruction?.text || "",
                  })),
                  nodeCount: retellNodes.length,
                };
                break;
              }
            } catch {
              // Silently continue — agent may not have Retell configured
            }
          }
          setDeployedAgentFlow(foundDeployed);
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

  // Fetch DB-sourced templates (augments code-generated fallback)
  useEffect(() => {
    async function fetchTemplates() {
      const supabase = createClient();
      const { data } = await supabase
        .from("agent_templates")
        .select("industry, use_case, default_flow_nodes, agent_name")
        .not("default_flow_nodes", "is", null)
        .not("industry", "is", null)
        .not("use_case", "is", null);

      if (data && data.length > 0) {
        const dbTemplates: FlowTemplate[] = data.map((row) => {
          const ind = INDUSTRIES[row.industry!];
          const uc = USE_CASES[row.use_case!];
          const nodes = row.default_flow_nodes as FlowNode[];
          return {
            industryKey: row.industry!,
            useCaseKey: row.use_case!,
            name: `${ind?.label ?? row.industry} ${uc?.label ?? row.use_case}`,
            industryLabel: ind?.label ?? row.industry!,
            useCaseLabel: uc?.label ?? row.use_case!,
            description: uc?.description ?? "",
            nodeCount: nodes.length,
            defaultFlowNodes: nodes,
          };
        });

        // Merge: DB templates take precedence, add code-only templates that aren't in DB
        const dbKeys = new Set(dbTemplates.map((t) => `${t.industryKey}_${t.useCaseKey}`));
        const merged = [
          ...dbTemplates,
          ...CODE_TEMPLATES.filter((t) => !dbKeys.has(`${t.industryKey}_${t.useCaseKey}`)),
        ];
        setAllTemplates(merged);
      }
    }
    fetchTemplates();
  }, []);

  // Derived: active flow & its agent
  const activeFlow = flows.find((f) => f.is_active) ?? null;
  const activeAgent = activeFlow
    ? agents.find((a) => a.id === activeFlow.agent_id) ?? null
    : null;

  function openEditorDirect(flow?: Flow) {
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

  function openEditor(flow?: Flow) {
    openEditorDirect(flow);
  }

  function openFromTemplate(template: FlowTemplate) {
    openFromTemplateDirect(template);
  }

  function openFromTemplateDirect(template: FlowTemplate) {
    setEditingFlow(null);
    setFlowName(template.name);
    setFlowAgentId("");
    // Prefer DB-stored flow nodes, fall back to code generation
    const templateNodes = template.defaultFlowNodes?.length
      ? template.defaultFlowNodes
      : generateTemplateNodes(template.industryKey, template.useCaseKey);
    setNodes(templateNodes);
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

  function requestDeploy() {
    if (!editingFlow || deploying) return;
    // If there's an existing active flow (DB or Retell) that isn't this flow, warn first
    const hasOtherActive = (activeFlow && activeFlow.id !== editingFlow.id) || (!activeFlow && !!deployedAgentFlow);
    if (hasOtherActive) {
      setConfirmDeploy(true);
    } else {
      handleDeploy();
    }
  }

  async function handleDeploy() {
    if (!editingFlow || deploying) return;
    setConfirmDeploy(false);

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
      setPromptPreview(
        data.prompt_preview ||
        (data.success
          ? `Deployed ${data.nodes_deployed || 0} nodes.\nTools: ${(data.tools_registered || []).join(", ") || "none"}\nFlow ID: ${data.retell_flow_id || "—"}`
          : null)
      );
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

  function requestDeleteFlow(flowId: string) {
    setFlowToDelete(flowId);
  }

  function confirmDeleteFlow() {
    if (!flowToDelete) return;
    handleDelete(flowToDelete);
    setFlowToDelete(null);
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
      ? allTemplates
      : allTemplates.filter((t) => t.useCaseKey === templateFilter);

  const renderTemplateCard = (t: FlowTemplate, idx: number) => {
    const style = INDUSTRY_STYLES[t.industryKey];
    const IndustryIcon = style?.icon ?? GitBranch;
    const UseCaseIcon = USE_CASES[t.useCaseKey]?.icon ?? UserCheck;
    const nodeCount = t.nodeCount || (USE_CASE_NODE_COUNTS[t.useCaseKey] ?? 0);
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
  };

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

        {/* Active Flow Hero */}
        {activeFlow && (
          <section className="relative rounded-xl border-2 border-transparent bg-clip-padding overflow-hidden"
            style={{
              backgroundImage: "linear-gradient(var(--background), var(--background)), linear-gradient(135deg, rgb(59 130 246), rgb(6 182 212))",
              backgroundOrigin: "padding-box, border-box",
            }}
          >
            <div className="p-5 md:p-6">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Left: Flow metadata */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5 pr-2.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      Currently Active
                    </Badge>
                  </div>

                  <h2 className="text-xl font-bold tracking-tight">{activeFlow.name}</h2>

                  {activeAgent && (
                    <p className="text-sm text-muted-foreground">
                      Agent: <span className="font-medium text-foreground">{activeAgent.name}</span>
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Deployed v{activeFlow.version}
                    </span>
                    <span>
                      Updated {new Date(activeFlow.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 text-xs"
                      onClick={() => openEditorDirect(activeFlow)}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 text-xs"
                      onClick={() => {
                        setEditingFlow(activeFlow);
                        setFlowName(activeFlow.name);
                        setFlowAgentId(activeFlow.agent_id || "");
                        setNodes(activeFlow.nodes || []);
                        setCreating(false);
                        setPromptPreview(null);
                        // Trigger deploy after a tick so editor state is set
                        setTimeout(() => {
                          const deployBtn = document.querySelector("[data-deploy-btn]") as HTMLButtonElement | null;
                          deployBtn?.click();
                        }, 100);
                      }}
                    >
                      <Rocket className="h-3 w-3" />
                      Re-deploy
                    </Button>
                  </div>
                </div>

                {/* Right: Visual flow preview */}
                <div className="lg:w-[300px] shrink-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    Flow Steps ({activeFlow.nodes?.length || 0})
                  </p>
                  {activeFlow.nodes && activeFlow.nodes.length > 0 ? (
                    <ActiveFlowPreview nodes={activeFlow.nodes} />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No nodes configured</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Deployed Agent Flow Hero (from Prompt Tree / Retell) */}
        {!activeFlow && deployedAgentFlow && (
          <section className="relative rounded-xl border-2 border-transparent bg-clip-padding overflow-hidden"
            style={{
              backgroundImage: "linear-gradient(var(--background), var(--background)), linear-gradient(135deg, rgb(59 130 246), rgb(6 182 212))",
              backgroundOrigin: "padding-box, border-box",
            }}
          >
            <div className="p-5 md:p-6">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Left: Flow metadata */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5 pr-2.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      Currently Active
                    </Badge>
                  </div>

                  <h2 className="text-xl font-bold tracking-tight">{deployedAgentFlow.agentName} Flow</h2>

                  <p className="text-sm text-muted-foreground">
                    Agent: <span className="font-medium text-foreground">{deployedAgentFlow.agentName}</span>
                  </p>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Deployed via Prompt Tree
                    </span>
                    <span>{deployedAgentFlow.nodeCount} nodes</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 text-xs"
                      onClick={() => {
                        window.location.href = `/${params.clientSlug}/portal/agents/${deployedAgentFlow.agentId}/prompt-tree`;
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit in Prompt Tree
                    </Button>
                  </div>
                </div>

                {/* Right: Visual flow preview */}
                <div className="lg:w-[300px] shrink-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    Flow Steps ({deployedAgentFlow.nodeCount})
                  </p>
                  {deployedAgentFlow.nodes.length > 0 ? (
                    <DeployedFlowPreview nodes={deployedAgentFlow.nodes} />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No nodes configured</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* No active flow banner (when flows exist but none active) */}
        {flows.length > 0 && !activeFlow && !deployedAgentFlow && (
          <section className="rounded-lg border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 flex items-center gap-3">
            <Rocket className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              No active flow deployed. Edit a flow and deploy it to your agent to go live.
            </p>
          </section>
        )}

        {/* Existing Flows — Empty State (only when no DB flows AND no deployed agent flow) */}
        {flows.length === 0 && !deployedAgentFlow && (
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
                          onClick={(e) => { e.stopPropagation(); requestDeleteFlow(flow.id); }}
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
              All ({allTemplates.length})
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
                const templates = allTemplates.filter((t) => t.useCaseKey === useCaseKey);
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
                      {templates.map((t, idx) => renderTemplateCard(t, idx))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredTemplates.map((t, idx) => renderTemplateCard(t, idx))}
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
            <DialogDescription>Configure the conversation flow steps.</DialogDescription>
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
                              value={node.data.provider ?? ""}
                              onValueChange={(value) =>
                                updateNodeData(node.id, { provider: value as "google" | "calendly" })
                              }
                            >
                              <SelectTrigger className="h-7 text-xs w-36">
                                <SelectValue placeholder="Select provider" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="google">Calendar</SelectItem>
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
                            <span className="text-xs text-muted-foreground">Looks up the caller in your CRM by phone number</span>
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
                <Label>Deployment Summary</Label>
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
                  data-deploy-btn
                  variant="outline"
                  onClick={requestDeploy}
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

      {/* Delete Flow AlertDialog */}
      <AlertDialog open={!!flowToDelete} onOpenChange={(open) => { if (!open) setFlowToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Flow</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The conversation flow will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteFlow} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Replace Active Flow — Deploy Confirmation */}
      <AlertDialog open={confirmDeploy} onOpenChange={(open) => { if (!open) setConfirmDeploy(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Active Flow?</AlertDialogTitle>
            <AlertDialogDescription>
              You currently have{" "}
              <span className="font-semibold text-foreground">
                {activeFlow?.name ?? (deployedAgentFlow ? `${deployedAgentFlow.agentName} Flow` : "an active flow")}
              </span>{" "}
              deployed. Deploying this flow will replace it as the active configuration on your agent.
              Your existing flow will remain saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeploy}>
              Replace &amp; Deploy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
