"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type OnConnect,
  type Connection,
  type EdgeChange,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2, Plus, Play } from "lucide-react";
import { toast } from "sonner";

import { nodeTypes } from "./prompt-tree-nodes";
import { PromptTreeToolbar } from "./prompt-tree-toolbar";
import { PromptTreeSidebar } from "./prompt-tree-sidebar";
import { CustomFunctionDialog, CalToolDialog, ToolConfigDialog } from "./prompt-tree-tool-dialog";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_FLOW_TEMPLATE,
  type ConversationFlowData,
  type ConversationFlowAPIResponse,
  type RetellNode,
  type PromptTreeNodeData,
  type PromptTreeNodeType,
  type RetellEdge,
  type BeginTagNodeData,
  type ConversationFlowTool,
  type ConversationFlowCustomTool,
  type CheckAvailabilityCalTool,
  type BookAppointmentCalTool,
} from "@/lib/prompt-tree-types";

// ─── Helpers: Retell <-> React Flow conversion ─────────────────────────────

function extractEdgesFromNode(node: RetellNode): Edge[] {
  const edges: Edge[] = [];

  const makeEdge = (id: string, source: string, target: string, label?: string): Edge => ({
    id,
    source,
    target,
    label,
    type: "smoothstep",
    animated: false,
    style: { stroke: "#94a3b8", strokeWidth: 2 },
    labelStyle: { fontSize: 11, fill: "#64748b", fontWeight: 500 },
    labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
    labelBgPadding: [6, 4] as [number, number],
    labelBgBorderRadius: 6,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 16, height: 16 },
  });

  switch (node.type) {
    case "conversation":
      if (node.edges) {
        for (const e of node.edges) {
          if (e.destination_node_id) {
            edges.push(
              makeEdge(
                e.id,
                node.id,
                e.destination_node_id,
                e.transition_condition?.type === "prompt"
                  ? e.transition_condition.prompt
                  : undefined
              )
            );
          }
        }
      }
      if (node.skip_response_edge?.destination_node_id) {
        edges.push(
          makeEdge(
            node.skip_response_edge.id,
            node.id,
            node.skip_response_edge.destination_node_id,
            "Skip response"
          )
        );
      }
      break;

    case "transfer_call":
      if (node.edge?.destination_node_id) {
        edges.push(
          makeEdge(node.edge.id, node.id, node.edge.destination_node_id, "Transfer failed")
        );
      }
      break;

    case "function":
      if (node.edges) {
        for (const e of node.edges) {
          if (e.destination_node_id) {
            edges.push(
              makeEdge(
                e.id,
                node.id,
                e.destination_node_id,
                e.transition_condition?.type === "prompt"
                  ? e.transition_condition.prompt
                  : undefined
              )
            );
          }
        }
      }
      break;

    case "sms":
      if (node.success_edge?.destination_node_id) {
        edges.push(
          makeEdge(node.success_edge.id, node.id, node.success_edge.destination_node_id, "SMS sent")
        );
      }
      if (node.failed_edge?.destination_node_id) {
        edges.push(
          makeEdge(node.failed_edge.id, node.id, node.failed_edge.destination_node_id, "SMS failed")
        );
      }
      break;

    case "press_digit":
      if (node.edges) {
        for (const e of node.edges) {
          if (e.destination_node_id) {
            edges.push(
              makeEdge(
                e.id,
                node.id,
                e.destination_node_id,
                e.transition_condition?.type === "prompt"
                  ? e.transition_condition.prompt
                  : undefined
              )
            );
          }
        }
      }
      break;

    case "branch":
      if (node.conditions) {
        for (const cond of node.conditions) {
          if (cond.destination_node_id) {
            edges.push(
              makeEdge(
                cond.id,
                node.id,
                cond.destination_node_id,
                cond.condition?.type === "prompt"
                  ? cond.condition.prompt
                  : "Condition"
              )
            );
          }
        }
      }
      if (node.else_edge?.destination_node_id) {
        edges.push(
          makeEdge(node.else_edge.id, node.id, node.else_edge.destination_node_id, "Else")
        );
      }
      break;

    case "agent_swap":
      if (node.edge?.destination_node_id) {
        edges.push(
          makeEdge(node.edge.id, node.id, node.edge.destination_node_id, "Swap failed")
        );
      }
      break;
  }

  return edges;
}

function retellNodeToFlowNode(node: RetellNode): Node<PromptTreeNodeData> {
  const position = {
    x: node.display_position?.x ?? 0,
    y: node.display_position?.y ?? 0,
  };
  const base = {
    name: node.name ?? node.type,
    global_node_setting: node.global_node_setting,
  };

  switch (node.type) {
    case "conversation":
      return {
        id: node.id,
        type: "conversation",
        position,
        data: {
          ...base,
          type: "conversation",
          instruction: node.instruction,
          edges: node.edges ?? [],
          model_choice: node.model_choice,
          interruption_sensitivity: node.interruption_sensitivity,
          knowledge_base_ids: node.knowledge_base_ids,
          skip_response_edge: node.skip_response_edge,
          responsiveness: node.responsiveness,
          voice_speed: node.voice_speed,
        },
      };
    case "end":
      return {
        id: node.id,
        type: "end",
        position,
        data: {
          ...base,
          type: "end",
          instruction: node.instruction,
          speak_during_execution: node.speak_during_execution,
        },
      };
    case "transfer_call":
      return {
        id: node.id,
        type: "transfer_call",
        position,
        data: {
          ...base,
          type: "transfer_call",
          transfer_destination: node.transfer_destination,
          transfer_option: node.transfer_option,
          edge: node.edge,
          model_choice: node.model_choice,
          ignore_e164_validation: node.ignore_e164_validation,
          speak_during_execution: node.speak_during_execution,
          instruction: node.instruction,
          custom_sip_headers: node.custom_sip_headers,
        },
      };
    case "function":
      return {
        id: node.id,
        type: "function",
        position,
        data: {
          ...base,
          type: "function",
          tool_id: node.tool_id,
          tool_type: node.tool_type,
          wait_for_result: node.wait_for_result,
          edges: node.edges ?? [],
          instruction: node.instruction,
          speak_during_execution: node.speak_during_execution,
          model_choice: node.model_choice,
        },
      };
    case "sms":
      return {
        id: node.id,
        type: "sms",
        position,
        data: {
          ...base,
          type: "sms",
          sms_content: node.sms_content,
          success_edge: node.success_edge,
          failed_edge: node.failed_edge,
        },
      };
    case "press_digit":
      return {
        id: node.id,
        type: "press_digit",
        position,
        data: {
          ...base,
          type: "press_digit",
          instruction: node.instruction,
          delay_ms: node.delay_ms,
          edges: node.edges ?? [],
          model_choice: node.model_choice,
        },
      };
    case "branch":
      return {
        id: node.id,
        type: "branch",
        position,
        data: {
          ...base,
          type: "branch",
          conditions: node.conditions ?? [],
          else_edge: node.else_edge,
        },
      };
    case "agent_swap":
      return {
        id: node.id,
        type: "agent_swap",
        position,
        data: {
          ...base,
          type: "agent_swap",
          agent_id: node.agent_id,
          edge: node.edge,
          agent_version: node.agent_version,
          post_call_analysis_setting: node.post_call_analysis_setting,
          webhook_setting: node.webhook_setting,
          keep_current_voice: node.keep_current_voice,
          speak_during_execution: node.speak_during_execution,
          instruction: node.instruction,
        },
      };
  }
}

function flowNodesToRetell(
  rfNodes: Node<PromptTreeNodeData>[],
  rfEdges: Edge[]
): RetellNode[] {
  // Filter out UI-only nodes (begin tag) and assert the narrowed type
  const realNodes = rfNodes.filter(
    (n): n is Node<Exclude<PromptTreeNodeData, BeginTagNodeData>> =>
      n.data.type !== "begin_tag"
  );
  return realNodes.map((rfNode) => {
    const data = rfNode.data;
    const displayPosition = { x: rfNode.position.x, y: rfNode.position.y };
    const outgoing = rfEdges.filter((e) => e.source === rfNode.id);

    function toRetellEdge(e: Edge): RetellEdge {
      return {
        id: e.id,
        destination_node_id: e.target,
        transition_condition: {
          type: "prompt",
          prompt: typeof e.label === "string" ? e.label : "",
        },
      };
    }

    const base = {
      id: rfNode.id,
      name: data.name,
      display_position: displayPosition,
      global_node_setting: data.global_node_setting,
    };

    // Merge node data edges (sidebar-editable, source of truth for conditions)
    // with drag-created visual edges (created by user connections on canvas).
    // Node data edges take priority; drag-created edges are added if they
    // don't already exist in node data.
    function mergeEdges(dataEdges: RetellEdge[]): RetellEdge[] {
      const dataEdgeIds = new Set(dataEdges.map((e) => e.id));
      const dragCreated = outgoing
        .filter(
          (e) =>
            !dataEdgeIds.has(e.id) &&
            e.label !== "Skip response"
        )
        .map(toRetellEdge);
      return [...dataEdges, ...dragCreated];
    }

    switch (data.type) {
      case "conversation":
        return {
          ...base,
          type: "conversation" as const,
          instruction: data.instruction,
          edges: mergeEdges(data.edges ?? []),
          model_choice: data.model_choice,
          interruption_sensitivity: data.interruption_sensitivity,
          knowledge_base_ids: data.knowledge_base_ids,
          skip_response_edge: data.skip_response_edge,
          responsiveness: data.responsiveness,
          voice_speed: data.voice_speed,
        };

      case "end":
        return {
          ...base,
          type: "end" as const,
          instruction: data.instruction,
          speak_during_execution: data.speak_during_execution,
        };

      case "transfer_call": {
        const failedEdge = outgoing[0];
        return {
          ...base,
          type: "transfer_call" as const,
          transfer_destination: data.transfer_destination,
          transfer_option: data.transfer_option,
          edge: failedEdge
            ? toRetellEdge(failedEdge)
            : data.edge,
          model_choice: data.model_choice,
          ignore_e164_validation: data.ignore_e164_validation,
          speak_during_execution: data.speak_during_execution,
          instruction: data.instruction,
          custom_sip_headers: data.custom_sip_headers,
        };
      }

      case "function":
        return {
          ...base,
          type: "function" as const,
          tool_id: data.tool_id,
          tool_type: data.tool_type,
          wait_for_result: data.wait_for_result,
          edges: mergeEdges(data.edges ?? []),
          instruction: data.instruction,
          speak_during_execution: data.speak_during_execution,
          model_choice: data.model_choice,
        };

      case "sms": {
        const success = outgoing.find((e) => e.label === "SMS sent");
        const failed = outgoing.find((e) => e.label === "SMS failed");
        return {
          ...base,
          type: "sms" as const,
          sms_content: data.sms_content,
          success_edge: success ? toRetellEdge(success) : data.success_edge,
          failed_edge: failed ? toRetellEdge(failed) : data.failed_edge,
        };
      }

      case "press_digit":
        return {
          ...base,
          type: "press_digit" as const,
          instruction: data.instruction,
          delay_ms: data.delay_ms,
          edges: mergeEdges(data.edges ?? []),
          model_choice: data.model_choice,
        };

      case "branch": {
        const elseEdge = outgoing.find(
          (e) => typeof e.label === "string" && e.label === "Else"
        );
        const condEdges = outgoing.filter((e) => e !== elseEdge);
        return {
          ...base,
          type: "branch" as const,
          conditions: condEdges.map((e) => ({
            id: e.id,
            condition: {
              type: "prompt" as const,
              prompt: typeof e.label === "string" ? e.label : "",
            },
            destination_node_id: e.target,
          })),
          else_edge: elseEdge ? toRetellEdge(elseEdge) : data.else_edge,
        };
      }

      case "agent_swap": {
        const swapEdge = outgoing[0];
        return {
          ...base,
          type: "agent_swap" as const,
          agent_id: data.agent_id,
          edge: swapEdge ? toRetellEdge(swapEdge) : data.edge,
          agent_version: data.agent_version,
          post_call_analysis_setting: data.post_call_analysis_setting,
          webhook_setting: data.webhook_setting,
          keep_current_voice: data.keep_current_voice,
          speak_during_execution: data.speak_during_execution,
          instruction: data.instruction,
        };
      }

      default:
        // begin_tag and other UI-only types should be filtered before this point
        return { ...base, type: "end" as const };
    }
  });
}

// ─── Default data factories ─────────────────────────────────────────────────

function makeId() {
  return "node_" + Math.random().toString(36).slice(2, 10);
}

function defaultNodeData(type: PromptTreeNodeType): PromptTreeNodeData {
  // Use underscore-separated names safe for retell-llm state names
  // (a-z, A-Z, 0-9, underscore, dash, max 64 chars)
  const suffix = Math.random().toString(36).slice(2, 6);
  const name =
    type === "conversation"
      ? `new_conversation_${suffix}`
      : type === "end"
        ? `end_call_${suffix}`
        : type === "transfer_call"
          ? `transfer_call_${suffix}`
          : type === "function"
            ? `function_${suffix}`
            : type === "sms"
              ? `sms_${suffix}`
              : type === "press_digit"
                ? `press_digit_${suffix}`
                : type === "branch"
                  ? `branch_${suffix}`
                  : `agent_swap_${suffix}`;

  switch (type) {
    case "conversation":
      return {
        type: "conversation",
        name,
        instruction: { text: "", type: "prompt" },
        edges: [],
      };
    case "end":
      return { type: "end", name };
    case "transfer_call":
      return {
        type: "transfer_call",
        name,
        transfer_destination: { type: "inferred", prompt: "" },
        transfer_option: { type: "cold_transfer" },
        edge: {
          id: "edge_" + Math.random().toString(36).slice(2, 10),
          transition_condition: { type: "prompt", prompt: "Transfer failed" },
        },
      };
    case "function":
      return {
        type: "function",
        name,
        tool_id: "",
        tool_type: "local",
        wait_for_result: true,
        edges: [],
      };
    case "sms":
      return { type: "sms", name, sms_content: "" };
    case "press_digit":
      return {
        type: "press_digit",
        name,
        instruction: { text: "", type: "prompt" },
        edges: [],
      };
    case "branch":
      return { type: "branch", name, conditions: [] };
    case "agent_swap":
      return { type: "agent_swap", name, agent_id: "" };
  }
}

// ─── Editor component ───────────────────────────────────────────────────────

interface PromptTreeEditorProps {
  agentId: string;
}

export function PromptTreeEditor({ agentId }: PromptTreeEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PromptTreeNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowData, setFlowData] = useState<Partial<ConversationFlowData>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flowExists, setFlowExists] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Engine metadata for retell-llm compatibility
  const [engineType, setEngineType] = useState<"conversation-flow" | "retell-llm" | null>(null);
  const [llmId, setLlmId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [retellLlmData, setRetellLlmData] = useState<any>(null);

  // ── Load flow ───────────────────────────────────────────────────────────

  const loadFlow = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/conversation-flow`);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Failed to load flow (${res.status})`);
      }
      const data: ConversationFlowAPIResponse = await res.json();

      if (data.exists && data.flow) {
        setFlowExists(true);

        // Capture engine metadata for retell-llm round-tripping
        if (data.engine_type) setEngineType(data.engine_type);
        if (data.llm_id) setLlmId(data.llm_id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((data as any)._retell_llm_data) setRetellLlmData((data as any)._retell_llm_data);

        setFlowData({
          conversation_flow_id: data.conversation_flow_id,
          global_prompt: data.flow.global_prompt,
          model_choice: data.flow.model_choice,
          start_node_id: data.flow.start_node_id,
          start_speaker: data.flow.start_speaker,
          begin_tag_display_position: data.flow.begin_tag_display_position,
          tools: data.flow.tools ?? [],
          model_temperature: data.flow.model_temperature,
          knowledge_base_ids: data.flow.knowledge_base_ids,
          default_dynamic_variables: data.flow.default_dynamic_variables,
          tool_call_strict_mode: data.flow.tool_call_strict_mode,
          version: data.flow.version,
        });

        const rfNodes: Node<PromptTreeNodeData>[] = data.flow.nodes.map(retellNodeToFlowNode);
        const rfEdges: Edge[] = data.flow.nodes.flatMap(extractEdgesFromNode);

        // Inject "Begin" tag node + edge to the start node
        const startNodeId = data.flow.start_node_id;
        const beginPos = data.flow.begin_tag_display_position;
        const startNode = startNodeId ? rfNodes.find((n) => n.id === startNodeId) : rfNodes[0];
        if (startNode) {
          const beginX = beginPos?.x ?? (startNode.position.x + 50);
          const beginY = beginPos?.y ?? (startNode.position.y - 120);
          rfNodes.unshift({
            id: "__begin_tag__",
            type: "begin_tag",
            position: { x: beginX, y: beginY },
            data: {
              type: "begin_tag",
              startSpeaker: data.flow.start_speaker ?? "agent",
            } as BeginTagNodeData as PromptTreeNodeData,
            draggable: true,
            selectable: false,
            deletable: false,
          });
          rfEdges.unshift({
            id: "__begin_edge__",
            source: "__begin_tag__",
            target: startNode.id,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#10b981", strokeWidth: 2, strokeDasharray: "6 3" },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981", width: 16, height: 16 },
            deletable: false,
          });
        }

        setNodes(rfNodes);
        setEdges(rfEdges);
      } else {
        setFlowExists(false);
        // Capture engine metadata even when flow doesn't exist
        if (data.engine_type) setEngineType(data.engine_type);
        if (data.llm_id) setLlmId(data.llm_id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load conversation flow";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [agentId, setNodes, setEdges]);

  useEffect(() => {
    loadFlow();
  }, [loadFlow]);

  // ── Save flow ───────────────────────────────────────────────────────────

  const saveFlow = useCallback(
    async (template?: ConversationFlowData) => {
      setSaving(true);
      try {
        let payload: Record<string, unknown>;

        if (template) {
          payload = { ...template };
          // Include engine metadata for retell-llm
          if (engineType === "retell-llm") {
            payload.engine_type = engineType;
            payload.llm_id = llmId;
            payload._retell_llm_data = retellLlmData;
          }
        } else {
          // Filter out the begin_tag UI node before saving
          const realNodes = nodes.filter((n) => n.id !== "__begin_tag__");
          const realEdges = edges.filter(
            (e) => e.id !== "__begin_edge__" && e.source !== "__begin_tag__"
          );
          const retellNodes = flowNodesToRetell(realNodes, realEdges);

          // Save begin tag position
          const beginNode = nodes.find((n) => n.id === "__begin_tag__");
          const beginTagPos = beginNode
            ? { x: beginNode.position.x, y: beginNode.position.y }
            : flowData.begin_tag_display_position;

          payload = {
            nodes: retellNodes,
            start_node_id: flowData.start_node_id,
            start_speaker: flowData.start_speaker ?? "agent",
            global_prompt: flowData.global_prompt,
            model_choice: flowData.model_choice,
            begin_tag_display_position: beginTagPos,
            tools: flowData.tools ?? [],
            model_temperature: flowData.model_temperature,
            knowledge_base_ids: flowData.knowledge_base_ids,
            default_dynamic_variables: flowData.default_dynamic_variables,
            tool_call_strict_mode: flowData.tool_call_strict_mode,
          };
          // Include engine metadata for retell-llm
          if (engineType === "retell-llm") {
            payload.engine_type = engineType;
            payload.llm_id = llmId;
            payload._retell_llm_data = retellLlmData;
          }
        }

        const res = await fetch(`/api/agents/${agentId}/conversation-flow`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Failed to save flow");
        }

        const data: ConversationFlowAPIResponse = await res.json();
        if (data.exists && data.flow) {
          setFlowExists(true);
          setFlowData((prev) => ({
            ...prev,
            conversation_flow_id: data.conversation_flow_id,
          }));

          // Update engine metadata (retell-llm data may have been updated)
          if (data.engine_type) setEngineType(data.engine_type);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((data as any)._retell_llm_data) setRetellLlmData((data as any)._retell_llm_data);

          const rfNodes: Node<PromptTreeNodeData>[] = data.flow.nodes.map(retellNodeToFlowNode);
          const rfEdges: Edge[] = data.flow.nodes.flatMap(extractEdgesFromNode);

          // For retell-llm, preserve existing canvas positions since the API
          // doesn't store display_position and convertLLMToFlow uses auto-layout.
          // Build a map of current positions keyed by node id AND name for matching
          // (node ids may change if renamed).
          if (data.engine_type === "retell-llm") {
            const posMap = new Map<string, { x: number; y: number }>();
            for (const n of nodes) {
              if (n.id !== "__begin_tag__") {
                posMap.set(n.id, { x: n.position.x, y: n.position.y });
                const name = (n.data as { name?: string }).name;
                if (name && name !== n.id) posMap.set(name, { x: n.position.x, y: n.position.y });
              }
            }
            for (const rfNode of rfNodes) {
              const saved = posMap.get(rfNode.id) ?? posMap.get((rfNode.data as { name?: string }).name ?? "");
              if (saved) rfNode.position = saved;
            }
          }

          // Re-inject begin tag
          const startNodeId = data.flow.start_node_id;
          const startNode = startNodeId ? rfNodes.find((n) => n.id === startNodeId) : rfNodes[0];
          const beginNode = nodes.find((n) => n.id === "__begin_tag__");
          if (startNode) {
            rfNodes.unshift({
              id: "__begin_tag__",
              type: "begin_tag",
              position: beginNode
                ? { x: beginNode.position.x, y: beginNode.position.y }
                : { x: startNode.position.x + 50, y: startNode.position.y - 120 },
              data: {
                type: "begin_tag",
                startSpeaker: data.flow.start_speaker ?? "agent",
              } as BeginTagNodeData as PromptTreeNodeData,
              draggable: true,
              selectable: false,
              deletable: false,
            });
            rfEdges.unshift({
              id: "__begin_edge__",
              source: "__begin_tag__",
              target: startNode.id,
              type: "smoothstep",
              animated: true,
              style: { stroke: "#10b981", strokeWidth: 2, strokeDasharray: "6 3" },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981", width: 16, height: 16 },
              deletable: false,
            });
          }

          setNodes(rfNodes);
          setEdges(rfEdges);
        }

        toast.success("Conversation flow saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save conversation flow");
      } finally {
        setSaving(false);
      }
    },
    [agentId, nodes, edges, flowData, setNodes, setEdges, engineType, llmId, retellLlmData]
  );

  // ── Auto-save (debounced, quiet — no toast, no reload) ──────────────

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveInFlight = useRef(false);

  const autoSave = useCallback(() => {
    if (!flowExists || autoSaveInFlight.current) return;

    // Filter out the begin_tag UI node before saving
    const realNodes = nodes.filter((n) => n.id !== "__begin_tag__");
    const realEdges = edges.filter(
      (e) => e.id !== "__begin_edge__" && e.source !== "__begin_tag__"
    );
    if (realNodes.length === 0) return;

    const retellNodes = flowNodesToRetell(realNodes, realEdges);
    const beginNode = nodes.find((n) => n.id === "__begin_tag__");
    const beginTagPos = beginNode
      ? { x: beginNode.position.x, y: beginNode.position.y }
      : flowData.begin_tag_display_position;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      nodes: retellNodes,
      start_node_id: flowData.start_node_id,
      start_speaker: flowData.start_speaker ?? "agent",
      global_prompt: flowData.global_prompt,
      model_choice: flowData.model_choice,
      begin_tag_display_position: beginTagPos,
      tools: flowData.tools ?? [],
      model_temperature: flowData.model_temperature,
      knowledge_base_ids: flowData.knowledge_base_ids,
      default_dynamic_variables: flowData.default_dynamic_variables,
      tool_call_strict_mode: flowData.tool_call_strict_mode,
    };

    // Include engine metadata for retell-llm
    if (engineType === "retell-llm") {
      payload.engine_type = engineType;
      payload.llm_id = llmId;
      payload._retell_llm_data = retellLlmData;
    }

    autoSaveInFlight.current = true;
    setSaving(true);
    fetch(`/api/agents/${agentId}/conversation-flow`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (res.ok) {
          setLastSavedAt(new Date());
          setHasUnsavedChanges(false);
          // Update retell-llm data from response to keep it fresh
          try {
            const data = await res.json();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((data as any)._retell_llm_data) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              setRetellLlmData((data as any)._retell_llm_data);
            }
          } catch {
            // Response parsing failed, but save succeeded — not critical
          }
        } else {
          console.error("Auto-save failed:", res.status);
        }
      })
      .catch((err) => console.error("Auto-save error:", err))
      .finally(() => {
        autoSaveInFlight.current = false;
        setSaving(false);
      });
  }, [agentId, nodes, edges, flowData, flowExists, engineType, llmId, retellLlmData]);

  // Track unsaved changes & trigger auto-save 2s after any change
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!flowExists || loading) return;
    // Skip the first render right after loading
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }
    setHasUnsavedChanges(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(autoSave, 2000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [nodes, edges, flowData, autoSave, flowExists, loading]);

  // Also save immediately on unmount (tab switch)
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        // Fire the save synchronously on unmount isn't possible with fetch,
        // but we can use navigator.sendBeacon as a fire-and-forget
      }
    };
  }, []);

  // ── Callbacks ─────────────────────────────────────────────────────────

  const defaultEdgeOptions = useMemo(
    () => ({
      type: "smoothstep",
      style: { stroke: "#94a3b8", strokeWidth: 2 },
      labelStyle: { fontSize: 11, fill: "#64748b", fontWeight: 500 },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 6,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 16, height: 16 },
    }),
    []
  );

  // Wrap onEdgesChange to sync edge removals to node data
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);

      // Detect removed edges and clean them from node data
      const removedEdgeIds = changes
        .filter((c) => c.type === "remove")
        .map((c) => c.id);

      if (removedEdgeIds.length > 0) {
        const removedSet = new Set(removedEdgeIds);
        setNodes((nds) =>
          nds.map((n) => {
            const data = n.data as PromptTreeNodeData;
            if (
              (data.type === "conversation" ||
                data.type === "function" ||
                data.type === "press_digit") &&
              data.edges?.some((e) => removedSet.has(e.id))
            ) {
              return {
                ...n,
                data: {
                  ...data,
                  edges: data.edges.filter((e) => !removedSet.has(e.id)),
                } as PromptTreeNodeData,
              };
            }
            return n;
          })
        );
      }
    },
    [onEdgesChange, setNodes]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const edgeId = "edge_" + Math.random().toString(36).slice(2, 10);
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: edgeId,
          },
          eds
        )
      );
      // Also add the edge to the source node's data (so sidebar shows it)
      if (connection.source && connection.target) {
        const newRetellEdge: RetellEdge = {
          id: edgeId,
          destination_node_id: connection.target,
          transition_condition: { type: "prompt", prompt: "" },
        };
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== connection.source) return n;
            const data = n.data as PromptTreeNodeData;
            // Add edge to node types that have an edges array
            if (
              data.type === "conversation" ||
              data.type === "function" ||
              data.type === "press_digit"
            ) {
              return {
                ...n,
                data: {
                  ...data,
                  edges: [...(data.edges ?? []), newRetellEdge],
                } as PromptTreeNodeData,
              };
            }
            return n;
          })
        );
      }
    },
    [setEdges, setNodes]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Don't open sidebar for the begin tag
      if (node.id === "__begin_tag__") return;
      setSelectedNodeId(node.id);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleAddNode = useCallback(
    (type: PromptTreeNodeType) => {
      const id = makeId();
      const newNode: Node<PromptTreeNodeData> = {
        id,
        type,
        position: { x: 250, y: 250 },
        data: defaultNodeData(type),
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const handleUpdateNodeData = useCallback(
    (nodeId: string, patch: Partial<PromptTreeNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          return {
            ...n,
            data: { ...n.data, ...patch } as PromptTreeNodeData,
          };
        })
      );

      // Sync visual React Flow edges when node data edges change
      // This keeps the canvas in sync with sidebar transition edits
      if ("edges" in patch && Array.isArray(patch.edges)) {
        const nodeDataEdges = patch.edges as RetellEdge[];
        setEdges((eds) => {
          // Keep non-matching edges and special edges
          const otherEdges = eds.filter(
            (e) => e.source !== nodeId || e.id === "__begin_edge__"
          );
          // Recreate visual edges from node data
          const updatedVisualEdges: Edge[] = nodeDataEdges
            .filter((e) => e.destination_node_id)
            .map((e) => ({
              id: e.id,
              source: nodeId,
              target: e.destination_node_id!,
              label:
                e.transition_condition?.type === "prompt"
                  ? e.transition_condition.prompt
                  : undefined,
              type: "smoothstep",
              animated: false,
              style: { stroke: "#94a3b8", strokeWidth: 2 },
              labelStyle: { fontSize: 11, fill: "#64748b", fontWeight: 500 },
              labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
              labelBgPadding: [6, 4] as [number, number],
              labelBgBorderRadius: 6,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: "#94a3b8",
                width: 16,
                height: 16,
              },
            }));
          return [...otherEdges, ...updatedVisualEdges];
        });
      }
    },
    [setNodes, setEdges]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      // Remove the node and clean up edges in other nodes' data that pointed to it
      setNodes((nds) =>
        nds
          .filter((n) => n.id !== nodeId)
          .map((n) => {
            const data = n.data as PromptTreeNodeData;
            // Clean edges arrays that reference the deleted node
            if (
              (data.type === "conversation" ||
                data.type === "function" ||
                data.type === "press_digit") &&
              data.edges?.some((e) => e.destination_node_id === nodeId)
            ) {
              return {
                ...n,
                data: {
                  ...data,
                  edges: data.edges.filter(
                    (e) => e.destination_node_id !== nodeId
                  ),
                } as PromptTreeNodeData,
              };
            }
            return n;
          })
      );
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [setNodes, setEdges, selectedNodeId]
  );

  const handleSetStartNode = useCallback(
    (nodeId: string) => {
      setFlowData((prev) => ({ ...prev, start_node_id: nodeId }));
      // Move the begin edge to point at the new start node
      setEdges((eds) =>
        eds.map((e) =>
          e.id === "__begin_edge__" ? { ...e, target: nodeId } : e
        )
      );
    },
    [setEdges]
  );

  // ── Tool management ─────────────────────────────────────────────────

  const [editingToolIndex, setEditingToolIndex] = useState<number | null>(null);
  const [editingToolType, setEditingToolType] = useState<string | null>(null);

  const handleUpdateTools = useCallback(
    (tools: ConversationFlowTool[]) => {
      setFlowData((prev) => ({ ...prev, tools }));
    },
    []
  );

  const handleAddTool = useCallback((type: string) => {
    setEditingToolIndex(null);
    setEditingToolType(type);
  }, []);

  const handleEditTool = useCallback(
    (toolIndex: number) => {
      const tools = flowData.tools ?? [];
      const tool = tools[toolIndex];
      if (!tool) return;
      setEditingToolIndex(toolIndex);
      setEditingToolType(tool.type);
    },
    [flowData.tools]
  );

  const handleSaveCustomTool = useCallback(
    (tool: ConversationFlowCustomTool) => {
      const tools = [...(flowData.tools ?? [])];
      if (editingToolIndex !== null && editingToolIndex < tools.length) {
        tools[editingToolIndex] = tool;
      } else {
        tools.push(tool);
      }
      setFlowData((prev) => ({ ...prev, tools }));
      setEditingToolType(null);
      setEditingToolIndex(null);
    },
    [flowData.tools, editingToolIndex]
  );

  const handleSaveCalTool = useCallback(
    (tool: CheckAvailabilityCalTool | BookAppointmentCalTool) => {
      const tools = [...(flowData.tools ?? [])];
      if (editingToolIndex !== null && editingToolIndex < tools.length) {
        tools[editingToolIndex] = tool;
      } else {
        tools.push(tool);
      }
      setFlowData((prev) => ({ ...prev, tools }));
      setEditingToolType(null);
      setEditingToolIndex(null);
    },
    [flowData.tools, editingToolIndex]
  );

  const handleSaveGenericTool = useCallback(
    (tool: ConversationFlowTool) => {
      const tools = [...(flowData.tools ?? [])];
      if (editingToolIndex !== null && editingToolIndex < tools.length) {
        tools[editingToolIndex] = tool;
      } else {
        tools.push(tool);
      }
      setFlowData((prev) => ({ ...prev, tools }));
      setEditingToolType(null);
      setEditingToolIndex(null);
    },
    [flowData.tools, editingToolIndex]
  );

  // ── Selected node reference ───────────────────────────────────────────

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  // ── Loading state ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-220px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error state: show retry, NOT the create CTA ──────────────────────

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-220px)] bg-gray-50/50">
        <div className="max-w-md w-full text-center space-y-6 p-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
            <span className="text-2xl">⚠</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">
              Failed to Load Conversation Flow
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              {loadError}
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => loadFlow()}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── No flow yet: show CTA ─────────────────────────────────────────────

  if (!flowExists) {
    const isRetellLlm = engineType === "retell-llm";
    return (
      <div className="flex items-center justify-center h-[calc(100vh-220px)] bg-gray-50/50">
        <div className="max-w-md w-full text-center space-y-6 p-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Play className="h-7 w-7 text-blue-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">
              {isRetellLlm ? "Enable Multi-Prompt Flow" : "Create Conversation Flow"}
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              {isRetellLlm
                ? "This agent currently uses a single prompt. Create a multi-state conversation flow to add distinct states with transitions and conditions."
                : "Design a visual conversation flow for this agent. Build a multi-node conversation tree with transitions, conditions, and actions."}
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => saveFlow(DEFAULT_FLOW_TEMPLATE)}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {saving ? "Creating..." : isRetellLlm ? "Create States" : "Create Flow"}
          </Button>
          <p className="text-xs text-gray-400">
            This works alongside your system prompt to add detailed, multi-state conversation logic.
          </p>
        </div>
      </div>
    );
  }

  // ── Main editor ───────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-220px)] flex rounded-lg border overflow-hidden bg-white">
      <div className="flex-1 flex flex-col">
        <PromptTreeToolbar
          onSave={() => saveFlow()}
          saving={saving}
          lastSavedAt={lastSavedAt}
          hasUnsavedChanges={hasUnsavedChanges}
          onAddNode={handleAddNode}
          globalPrompt={flowData.global_prompt ?? null}
          onGlobalPromptChange={(prompt) =>
            setFlowData((prev) => ({ ...prev, global_prompt: prompt }))
          }
          modelChoice={flowData.model_choice}
          onModelChoiceChange={(model) =>
            setFlowData((prev) => ({ ...prev, model_choice: model }))
          }
          startSpeaker={flowData.start_speaker ?? "agent"}
          onStartSpeakerChange={(speaker) => {
            setFlowData((prev) => ({ ...prev, start_speaker: speaker }));
            // Update begin tag node data to reflect new speaker
            setNodes((nds) =>
              nds.map((n) =>
                n.id === "__begin_tag__"
                  ? {
                      ...n,
                      data: { ...n.data, startSpeaker: speaker } as PromptTreeNodeData,
                    }
                  : n
              )
            );
          }}
        />
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            defaultEdgeOptions={defaultEdgeOptions}
            proOptions={{ hideAttribution: true }}
            className="bg-gray-50"
          >
            <Controls
              className="!rounded-lg !border !shadow-sm"
              position="bottom-left"
            />
            <MiniMap
              className="!rounded-lg !border !shadow-sm"
              position="bottom-right"
              nodeColor={(node) => {
                switch (node.type) {
                  case "conversation":
                    return "#3b82f6";
                  case "end":
                    return "#ef4444";
                  case "transfer_call":
                    return "#f97316";
                  case "function":
                    return "#a855f7";
                  case "sms":
                    return "#10b981";
                  case "press_digit":
                    return "#6366f1";
                  case "branch":
                    return "#f59e0b";
                  case "agent_swap":
                    return "#14b8a6";
                  default:
                    return "#94a3b8";
                }
              }}
              maskColor="rgba(0, 0, 0, 0.08)"
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#d1d5db"
            />
          </ReactFlow>
        </div>
      </div>
      {selectedNode && (
        <PromptTreeSidebar
          nodeId={selectedNode.id}
          nodeData={selectedNode.data as Exclude<PromptTreeNodeData, BeginTagNodeData>}
          allNodes={nodes
            .filter((n) => n.id !== "__begin_tag__")
            .map((n) => ({
              id: n.id,
              name: (n.data as { name?: string }).name ?? n.id,
            }))}
          startNodeId={flowData.start_node_id ?? null}
          tools={flowData.tools ?? []}
          onUpdateNodeData={handleUpdateNodeData}
          onDeleteNode={handleDeleteNode}
          onSetStartNode={handleSetStartNode}
          onUpdateTools={handleUpdateTools}
          onAddTool={handleAddTool}
          onEditTool={handleEditTool}
          onClose={() => setSelectedNodeId(null)}
        />
      )}

      {/* Tool Dialogs */}
      <CustomFunctionDialog
        open={editingToolType === "custom"}
        onOpenChange={(open) => {
          if (!open) {
            setEditingToolType(null);
            setEditingToolIndex(null);
          }
        }}
        tool={
          editingToolIndex !== null
            ? ((flowData.tools ?? [])[editingToolIndex] as ConversationFlowCustomTool) ?? null
            : null
        }
        onSave={handleSaveCustomTool}
      />
      <CalToolDialog
        open={editingToolType === "check_availability_cal" || editingToolType === "book_appointment_cal"}
        onOpenChange={(open) => {
          if (!open) {
            setEditingToolType(null);
            setEditingToolIndex(null);
          }
        }}
        tool={
          editingToolIndex !== null
            ? ((flowData.tools ?? [])[editingToolIndex] as CheckAvailabilityCalTool | BookAppointmentCalTool) ?? null
            : null
        }
        toolType={(editingToolType as "check_availability_cal" | "book_appointment_cal") ?? "check_availability_cal"}
        onSave={handleSaveCalTool}
      />
      {editingToolType &&
        ["end_call", "transfer_call", "agent_swap", "press_digit", "send_sms", "extract_dynamic_variable"].includes(editingToolType) && (
        <ToolConfigDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditingToolType(null);
              setEditingToolIndex(null);
            }
          }}
          toolType={editingToolType as "end_call" | "transfer_call" | "agent_swap" | "press_digit" | "send_sms" | "extract_dynamic_variable"}
          tool={
            editingToolIndex !== null
              ? (flowData.tools ?? [])[editingToolIndex] ?? null
              : null
          }
          onSave={handleSaveGenericTool}
        />
      )}
    </div>
  );
}
