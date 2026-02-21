"use client";

import { useState, useEffect, useCallback } from "react";
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
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { nodeTypes } from "./prompt-tree-nodes";
import { PromptTreeToolbar } from "./prompt-tree-toolbar";
import { PromptTreeSidebar } from "./prompt-tree-sidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  DEFAULT_FLOW_TEMPLATE,
  type ConversationFlowData,
  type ConversationFlowAPIResponse,
  type RetellNode,
  type PromptTreeNodeData,
  type PromptTreeNodeType,
  type RetellEdge,
} from "@/lib/prompt-tree-types";

// ─── Helpers: Retell <-> React Flow conversion ─────────────────────────────

function extractEdgesFromNode(node: RetellNode): Edge[] {
  const edges: Edge[] = [];

  switch (node.type) {
    case "conversation":
      if (node.edges) {
        for (const e of node.edges) {
          if (e.destination_node_id) {
            edges.push({
              id: e.id,
              source: node.id,
              target: e.destination_node_id,
              label:
                e.transition_condition?.type === "prompt"
                  ? e.transition_condition.prompt
                  : undefined,
            });
          }
        }
      }
      if (node.skip_response_edge?.destination_node_id) {
        edges.push({
          id: node.skip_response_edge.id,
          source: node.id,
          target: node.skip_response_edge.destination_node_id,
          label: "Skip response",
        });
      }
      break;

    case "transfer_call":
      if (node.edge?.destination_node_id) {
        edges.push({
          id: node.edge.id,
          source: node.id,
          target: node.edge.destination_node_id,
          label: "Transfer failed",
        });
      }
      break;

    case "function":
      if (node.edges) {
        for (const e of node.edges) {
          if (e.destination_node_id) {
            edges.push({
              id: e.id,
              source: node.id,
              target: e.destination_node_id,
              label:
                e.transition_condition?.type === "prompt"
                  ? e.transition_condition.prompt
                  : undefined,
            });
          }
        }
      }
      break;

    case "sms":
      if (node.success_edge?.destination_node_id) {
        edges.push({
          id: node.success_edge.id,
          source: node.id,
          target: node.success_edge.destination_node_id,
          label: "SMS sent",
        });
      }
      if (node.failed_edge?.destination_node_id) {
        edges.push({
          id: node.failed_edge.id,
          source: node.id,
          target: node.failed_edge.destination_node_id,
          label: "SMS failed",
        });
      }
      break;

    case "press_digit":
      if (node.edges) {
        for (const e of node.edges) {
          if (e.destination_node_id) {
            edges.push({
              id: e.id,
              source: node.id,
              target: e.destination_node_id,
              label:
                e.transition_condition?.type === "prompt"
                  ? e.transition_condition.prompt
                  : undefined,
            });
          }
        }
      }
      break;

    case "branch":
      if (node.conditions) {
        for (const cond of node.conditions) {
          if (cond.destination_node_id) {
            edges.push({
              id: cond.id,
              source: node.id,
              target: cond.destination_node_id,
              label:
                cond.condition?.type === "prompt"
                  ? cond.condition.prompt
                  : "Condition",
            });
          }
        }
      }
      if (node.else_edge?.destination_node_id) {
        edges.push({
          id: node.else_edge.id,
          source: node.id,
          target: node.else_edge.destination_node_id,
          label: "Else",
        });
      }
      break;

    case "agent_swap":
      if (node.edge?.destination_node_id) {
        edges.push({
          id: node.edge.id,
          source: node.id,
          target: node.edge.destination_node_id,
          label: "Swap failed",
        });
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
        },
      };
    case "end":
      return {
        id: node.id,
        type: "end",
        position,
        data: { ...base, type: "end" },
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
        },
      };
  }
}

function flowNodesToRetell(
  rfNodes: Node<PromptTreeNodeData>[],
  rfEdges: Edge[]
): RetellNode[] {
  return rfNodes.map((rfNode) => {
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

    switch (data.type) {
      case "conversation":
        return {
          ...base,
          type: "conversation" as const,
          instruction: data.instruction,
          edges: outgoing
            .filter((e) => e.label !== "Skip response")
            .map(toRetellEdge),
          model_choice: data.model_choice,
          interruption_sensitivity: data.interruption_sensitivity,
          knowledge_base_ids: data.knowledge_base_ids,
          skip_response_edge: data.skip_response_edge,
        };

      case "end":
        return { ...base, type: "end" as const };

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
        };
      }

      case "function":
        return {
          ...base,
          type: "function" as const,
          tool_id: data.tool_id,
          tool_type: data.tool_type,
          wait_for_result: data.wait_for_result,
          edges: outgoing.map(toRetellEdge),
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
          edges: outgoing.map(toRetellEdge),
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
        };
      }
    }
  });
}

// ─── Default data factories ─────────────────────────────────────────────────

function makeId() {
  return "node_" + Math.random().toString(36).slice(2, 10);
}

function defaultNodeData(type: PromptTreeNodeType): PromptTreeNodeData {
  const name =
    type === "conversation"
      ? "New Conversation"
      : type === "end"
        ? "End Call"
        : type === "transfer_call"
          ? "Transfer Call"
          : type === "function"
            ? "Function"
            : type === "sms"
              ? "SMS"
              : type === "press_digit"
                ? "Press Digit"
                : type === "branch"
                  ? "Branch"
                  : "Agent Swap";

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

  // ── Load flow ───────────────────────────────────────────────────────────

  const loadFlow = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/conversation-flow`);
      if (!res.ok) throw new Error("Failed to load flow");
      const data: ConversationFlowAPIResponse = await res.json();

      if (data.exists && data.flow) {
        setFlowExists(true);
        setFlowData({
          conversation_flow_id: data.conversation_flow_id,
          global_prompt: data.flow.global_prompt,
          model_choice: data.flow.model_choice,
          start_node_id: data.flow.start_node_id,
          start_speaker: data.flow.start_speaker,
          begin_tag_display_position: data.flow.begin_tag_display_position,
        });

        const rfNodes = data.flow.nodes.map(retellNodeToFlowNode);
        const rfEdges = data.flow.nodes.flatMap(extractEdgesFromNode);
        setNodes(rfNodes);
        setEdges(rfEdges);
      } else {
        setFlowExists(false);
      }
    } catch {
      toast.error("Failed to load conversation flow");
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
        } else {
          const retellNodes = flowNodesToRetell(nodes, edges);
          payload = {
            nodes: retellNodes,
            start_node_id: flowData.start_node_id,
            start_speaker: flowData.start_speaker ?? "agent",
            global_prompt: flowData.global_prompt,
            model_choice: flowData.model_choice,
          };
        }

        const res = await fetch(`/api/agents/${agentId}/conversation-flow`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Failed to save flow");

        const data: ConversationFlowAPIResponse = await res.json();
        if (data.exists && data.flow) {
          setFlowExists(true);
          setFlowData((prev) => ({
            ...prev,
            conversation_flow_id: data.conversation_flow_id,
          }));

          const rfNodes = data.flow.nodes.map(retellNodeToFlowNode);
          const rfEdges = data.flow.nodes.flatMap(extractEdgesFromNode);
          setNodes(rfNodes);
          setEdges(rfEdges);
        }

        toast.success("Conversation flow saved");
      } catch {
        toast.error("Failed to save conversation flow");
      } finally {
        setSaving(false);
      }
    },
    [agentId, nodes, edges, flowData, setNodes, setEdges]
  );

  // ── Callbacks ─────────────────────────────────────────────────────────

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: "edge_" + Math.random().toString(36).slice(2, 10),
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
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
    },
    [setNodes]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [setNodes, setEdges, selectedNodeId]
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

  // ── No flow yet: show CTA ─────────────────────────────────────────────

  if (!flowExists) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-220px)]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>Create Conversation Flow</CardTitle>
            <CardDescription>
              Design a visual conversation flow for this agent. This will
              replace the single-prompt response engine with a multi-node
              conversation tree.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button
              onClick={() => saveFlow(DEFAULT_FLOW_TEMPLATE)}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {saving ? "Creating..." : "Create Flow"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main editor ───────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-220px)] flex">
      <div className="flex-1 relative">
        <PromptTreeToolbar
          onSave={() => saveFlow()}
          saving={saving}
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
          onStartSpeakerChange={(speaker) =>
            setFlowData((prev) => ({ ...prev, start_speaker: speaker }))
          }
        />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          defaultEdgeOptions={{ type: "smoothstep", animated: true }}
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
      </div>
      {selectedNode && (
        <PromptTreeSidebar
          nodeId={selectedNode.id}
          nodeData={selectedNode.data}
          allNodes={nodes.map((n) => ({
            id: n.id,
            name: n.data.name ?? n.id,
          }))}
          onUpdateNodeData={handleUpdateNodeData}
          onDeleteNode={handleDeleteNode}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}
