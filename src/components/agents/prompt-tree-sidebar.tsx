"use client";

import { useCallback } from "react";
import {
  X,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  PromptTreeNodeData,
  ConversationNodeData,
  TransferCallNodeData,
  FunctionNodeData,
  SMSNodeData,
  PressDigitNodeData,
  BranchNodeData,
  AgentSwapNodeData,
  RetellEdge,
} from "@/lib/prompt-tree-types";

// ─── Props ──────────────────────────────────────────────────────────────────

interface PromptTreeSidebarProps {
  nodeId: string;
  nodeData: PromptTreeNodeData;
  allNodes: Array<{ id: string; name: string }>;
  onUpdateNodeData: (nodeId: string, data: Partial<PromptTreeNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const NODE_TYPE_LABELS: Record<string, string> = {
  conversation: "Conversation",
  end: "End Call",
  transfer_call: "Transfer Call",
  function: "Function",
  sms: "Send SMS",
  press_digit: "Press Digit",
  branch: "Branch",
  agent_swap: "Agent Swap",
};

function makeEdgeId() {
  return `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeConditionId() {
  return `cond_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Sub-sections ───────────────────────────────────────────────────────────

function EdgeListSection({
  edges,
  allNodes,
  onChange,
  label,
}: {
  edges: RetellEdge[];
  allNodes: Array<{ id: string; name: string }>;
  onChange: (edges: RetellEdge[]) => void;
  label: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </Label>
        <Button
          variant="ghost"
          size="xs"
          onClick={() =>
            onChange([
              ...edges,
              {
                id: makeEdgeId(),
                transition_condition: { type: "prompt", prompt: "" },
              },
            ])
          }
        >
          <Plus className="size-3" />
          Add
        </Button>
      </div>
      {edges.map((edge, i) => (
        <div key={edge.id} className="space-y-2 rounded-md border p-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <Input
                placeholder="Condition..."
                value={
                  edge.transition_condition.type === "prompt"
                    ? edge.transition_condition.prompt
                    : ""
                }
                onChange={(e) => {
                  const updated = [...edges];
                  updated[i] = {
                    ...edge,
                    transition_condition: {
                      type: "prompt",
                      prompt: e.target.value,
                    },
                  };
                  onChange(updated);
                }}
              />
              <Select
                value={edge.destination_node_id ?? ""}
                onValueChange={(val) => {
                  const updated = [...edges];
                  updated[i] = {
                    ...edge,
                    destination_node_id: val || undefined,
                  };
                  onChange(updated);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Destination node..." />
                </SelectTrigger>
                <SelectContent>
                  {allNodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onChange(edges.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
      ))}
      {edges.length === 0 && (
        <p className="text-xs text-muted-foreground">No transitions yet.</p>
      )}
    </div>
  );
}

function SingleEdgeSection({
  edge,
  allNodes,
  onChange,
  label,
}: {
  edge: RetellEdge | undefined;
  allNodes: Array<{ id: string; name: string }>;
  onChange: (edge: RetellEdge) => void;
  label: string;
}) {
  const current: RetellEdge = edge ?? {
    id: makeEdgeId(),
    transition_condition: { type: "prompt", prompt: "" },
  };
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Input
        placeholder="Condition..."
        value={
          current.transition_condition.type === "prompt"
            ? current.transition_condition.prompt
            : ""
        }
        onChange={(e) =>
          onChange({
            ...current,
            transition_condition: { type: "prompt", prompt: e.target.value },
          })
        }
      />
      <Select
        value={current.destination_node_id ?? ""}
        onValueChange={(val) =>
          onChange({ ...current, destination_node_id: val || undefined })
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Destination node..." />
        </SelectTrigger>
        <SelectContent>
          {allNodes.map((n) => (
            <SelectItem key={n.id} value={n.id}>
              {n.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Node-type specific editors ─────────────────────────────────────────────

function ConversationEditor({
  nodeId,
  data,
  allNodes,
  onUpdate,
}: {
  nodeId: string;
  data: ConversationNodeData;
  allNodes: Array<{ id: string; name: string }>;
  onUpdate: (patch: Partial<ConversationNodeData>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Instruction */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Instruction
        </Label>
        <Select
          value={data.instruction.type}
          onValueChange={(val) =>
            onUpdate({
              instruction: {
                ...data.instruction,
                type: val as "prompt" | "static_text",
              },
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="prompt">Prompt</SelectItem>
            <SelectItem value="static_text">Static Text</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          placeholder="Enter instruction text..."
          className="min-h-32"
          value={data.instruction.text}
          onChange={(e) =>
            onUpdate({
              instruction: { ...data.instruction, text: e.target.value },
            })
          }
        />
      </div>

      <Separator />

      {/* Transitions */}
      <EdgeListSection
        edges={data.edges ?? []}
        allNodes={allNodes}
        onChange={(edges) => onUpdate({ edges })}
        label="Transitions"
      />

      <Separator />

      {/* Settings */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Settings
        </Label>
        <div className="space-y-2">
          <Label className="text-xs">Model</Label>
          <Select
            value={data.model_choice?.model ?? ""}
            onValueChange={(val) =>
              onUpdate({
                model_choice: val
                  ? {
                      model: val as NonNullable<ConversationNodeData["model_choice"]>["model"],
                      type: "cascading" as const,
                    }
                  : undefined,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
              <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
              <SelectItem value="gpt-4.1-nano">gpt-4.1-nano</SelectItem>
              <SelectItem value="claude-4.5-sonnet">claude-4.5-sonnet</SelectItem>
              <SelectItem value="claude-4.5-haiku">claude-4.5-haiku</SelectItem>
              <SelectItem value="gemini-2.5-flash">gemini-2.5-flash</SelectItem>
              <SelectItem value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Interruption Sensitivity</Label>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.1}
            placeholder="Default"
            value={data.interruption_sensitivity ?? ""}
            onChange={(e) =>
              onUpdate({
                interruption_sensitivity: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

function EndEditor() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed p-4">
      <p className="text-sm text-muted-foreground">
        This node ends the call. No additional configuration needed.
      </p>
    </div>
  );
}

function TransferCallEditor({
  data,
  allNodes,
  onUpdate,
}: {
  data: TransferCallNodeData;
  allNodes: Array<{ id: string; name: string }>;
  onUpdate: (patch: Partial<TransferCallNodeData>) => void;
}) {
  const destType = data.transfer_destination.type;
  return (
    <div className="space-y-4">
      {/* Transfer Destination */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Transfer Destination
        </Label>
        <Select
          value={destType}
          onValueChange={(val) => {
            if (val === "predefined") {
              onUpdate({
                transfer_destination: { type: "predefined", number: "" },
              });
            } else {
              onUpdate({
                transfer_destination: { type: "inferred", prompt: "" },
              });
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="predefined">Predefined</SelectItem>
            <SelectItem value="inferred">Inferred</SelectItem>
          </SelectContent>
        </Select>
        {destType === "predefined" && (
          <Input
            placeholder="Phone number..."
            value={
              data.transfer_destination.type === "predefined"
                ? data.transfer_destination.number
                : ""
            }
            onChange={(e) =>
              onUpdate({
                transfer_destination: {
                  type: "predefined",
                  number: e.target.value,
                },
              })
            }
          />
        )}
        {destType === "inferred" && (
          <Textarea
            placeholder="Prompt to infer transfer destination..."
            value={
              data.transfer_destination.type === "inferred"
                ? data.transfer_destination.prompt
                : ""
            }
            onChange={(e) =>
              onUpdate({
                transfer_destination: {
                  type: "inferred",
                  prompt: e.target.value,
                },
              })
            }
          />
        )}
      </div>

      <Separator />

      {/* Transfer Mode */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Transfer Mode
        </Label>
        <Select
          value={data.transfer_option.type}
          onValueChange={(val) =>
            onUpdate({
              transfer_option: {
                type: val as
                  | "cold_transfer"
                  | "warm_transfer"
                  | "agentic_warm_transfer",
              },
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cold_transfer">Cold Transfer</SelectItem>
            <SelectItem value="warm_transfer">Warm Transfer</SelectItem>
            <SelectItem value="agentic_warm_transfer">
              Agentic Warm Transfer
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Transfer Failed Edge */}
      <SingleEdgeSection
        edge={data.edge}
        allNodes={allNodes}
        onChange={(edge) => onUpdate({ edge })}
        label="Transfer Failed Edge"
      />
    </div>
  );
}

function FunctionEditor({
  data,
  allNodes,
  onUpdate,
}: {
  data: FunctionNodeData;
  allNodes: Array<{ id: string; name: string }>;
  onUpdate: (patch: Partial<FunctionNodeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Tool ID</Label>
        <Input
          placeholder="tool_id..."
          value={data.tool_id}
          onChange={(e) => onUpdate({ tool_id: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Tool Type</Label>
        <Select
          value={data.tool_type}
          onValueChange={(val) =>
            onUpdate({ tool_type: val as "local" | "shared" })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">Local</SelectItem>
            <SelectItem value="shared">Shared</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Wait for Result</Label>
        <Switch
          checked={data.wait_for_result}
          onCheckedChange={(checked) =>
            onUpdate({ wait_for_result: !!checked })
          }
        />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Speak During Execution</Label>
        <Switch
          checked={data.speak_during_execution ?? false}
          onCheckedChange={(checked) =>
            onUpdate({ speak_during_execution: !!checked })
          }
        />
      </div>

      {/* Optional instruction */}
      <div className="space-y-2">
        <Label className="text-xs">Instruction (optional)</Label>
        <Textarea
          placeholder="Instruction text..."
          value={data.instruction?.text ?? ""}
          onChange={(e) =>
            onUpdate({
              instruction: e.target.value
                ? {
                    text: e.target.value,
                    type: data.instruction?.type ?? "prompt",
                  }
                : undefined,
            })
          }
        />
      </div>

      <Separator />

      <EdgeListSection
        edges={data.edges ?? []}
        allNodes={allNodes}
        onChange={(edges) => onUpdate({ edges })}
        label="Transitions"
      />
    </div>
  );
}

function SMSEditor({
  data,
  allNodes,
  onUpdate,
}: {
  data: SMSNodeData;
  allNodes: Array<{ id: string; name: string }>;
  onUpdate: (patch: Partial<SMSNodeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">SMS Content</Label>
        <Textarea
          placeholder="Message content..."
          className="min-h-24"
          value={data.sms_content}
          onChange={(e) => onUpdate({ sms_content: e.target.value })}
        />
      </div>

      <Separator />

      <SingleEdgeSection
        edge={data.success_edge}
        allNodes={allNodes}
        onChange={(edge) => onUpdate({ success_edge: edge })}
        label="Success Edge"
      />

      <Separator />

      <SingleEdgeSection
        edge={data.failed_edge}
        allNodes={allNodes}
        onChange={(edge) => onUpdate({ failed_edge: edge })}
        label="Failed Edge"
      />
    </div>
  );
}

function PressDigitEditor({
  data,
  allNodes,
  onUpdate,
}: {
  data: PressDigitNodeData;
  allNodes: Array<{ id: string; name: string }>;
  onUpdate: (patch: Partial<PressDigitNodeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Instruction</Label>
        <Textarea
          placeholder="Instruction text..."
          className="min-h-24"
          value={data.instruction.text}
          onChange={(e) =>
            onUpdate({
              instruction: { text: e.target.value, type: "prompt" },
            })
          }
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Delay (ms)</Label>
        <Input
          type="number"
          placeholder="e.g. 1000"
          value={data.delay_ms ?? ""}
          onChange={(e) =>
            onUpdate({
              delay_ms: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </div>

      <Separator />

      <EdgeListSection
        edges={data.edges ?? []}
        allNodes={allNodes}
        onChange={(edges) => onUpdate({ edges })}
        label="Transitions"
      />
    </div>
  );
}

function BranchEditor({
  data,
  allNodes,
  onUpdate,
}: {
  data: BranchNodeData;
  allNodes: Array<{ id: string; name: string }>;
  onUpdate: (patch: Partial<BranchNodeData>) => void;
}) {
  const conditions = data.conditions ?? [];
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Conditions
          </Label>
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              onUpdate({
                conditions: [
                  ...conditions,
                  {
                    id: makeConditionId(),
                    condition: { type: "prompt", prompt: "" },
                  },
                ],
              })
            }
          >
            <Plus className="size-3" />
            Add
          </Button>
        </div>
        {conditions.map((cond, i) => (
          <div key={cond.id} className="space-y-2 rounded-md border p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Condition..."
                  value={
                    cond.condition.type === "prompt"
                      ? cond.condition.prompt
                      : ""
                  }
                  onChange={(e) => {
                    const updated = [...conditions];
                    updated[i] = {
                      ...cond,
                      condition: { type: "prompt", prompt: e.target.value },
                    };
                    onUpdate({ conditions: updated });
                  }}
                />
                <Select
                  value={cond.destination_node_id ?? ""}
                  onValueChange={(val) => {
                    const updated = [...conditions];
                    updated[i] = {
                      ...cond,
                      destination_node_id: val || undefined,
                    };
                    onUpdate({ conditions: updated });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Destination node..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allNodes.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() =>
                  onUpdate({
                    conditions: conditions.filter((_, j) => j !== i),
                  })
                }
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        ))}
        {conditions.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No conditions yet.
          </p>
        )}
      </div>

      <Separator />

      {/* Else edge */}
      <SingleEdgeSection
        edge={data.else_edge}
        allNodes={allNodes}
        onChange={(edge) => onUpdate({ else_edge: edge })}
        label="Else Edge"
      />
    </div>
  );
}

function AgentSwapEditor({
  data,
  allNodes,
  onUpdate,
}: {
  data: AgentSwapNodeData;
  allNodes: Array<{ id: string; name: string }>;
  onUpdate: (patch: Partial<AgentSwapNodeData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Agent ID</Label>
        <Input
          placeholder="agent_id..."
          value={data.agent_id}
          onChange={(e) => onUpdate({ agent_id: e.target.value })}
        />
      </div>

      <Separator />

      <SingleEdgeSection
        edge={data.edge}
        allNodes={allNodes}
        onChange={(edge) => onUpdate({ edge })}
        label="Transition (optional)"
      />
    </div>
  );
}

// ─── Main Sidebar Component ─────────────────────────────────────────────────

export function PromptTreeSidebar({
  nodeId,
  nodeData,
  allNodes,
  onUpdateNodeData,
  onDeleteNode,
  onClose,
}: PromptTreeSidebarProps) {
  const handleUpdate = useCallback(
    (patch: Partial<PromptTreeNodeData>) => {
      onUpdateNodeData(nodeId, patch);
    },
    [nodeId, onUpdateNodeData]
  );

  return (
    <div className="flex h-full w-96 flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="flex-1 space-y-1">
          <Input
            className="h-7 text-sm font-semibold"
            value={nodeData.name}
            onChange={(e) => handleUpdate({ name: e.target.value })}
          />
          <Badge variant="secondary" className="text-[10px]">
            {NODE_TYPE_LABELS[nodeData.type] ?? nodeData.type}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onDeleteNode(nodeId)}
          title="Delete node"
        >
          <Trash2 className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          title="Close sidebar"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {nodeData.type === "conversation" && (
            <ConversationEditor
              nodeId={nodeId}
              data={nodeData}
              allNodes={allNodes}
              onUpdate={handleUpdate as (patch: Partial<ConversationNodeData>) => void}
            />
          )}
          {nodeData.type === "end" && <EndEditor />}
          {nodeData.type === "transfer_call" && (
            <TransferCallEditor
              data={nodeData}
              allNodes={allNodes}
              onUpdate={handleUpdate as (patch: Partial<TransferCallNodeData>) => void}
            />
          )}
          {nodeData.type === "function" && (
            <FunctionEditor
              data={nodeData}
              allNodes={allNodes}
              onUpdate={handleUpdate as (patch: Partial<FunctionNodeData>) => void}
            />
          )}
          {nodeData.type === "sms" && (
            <SMSEditor
              data={nodeData}
              allNodes={allNodes}
              onUpdate={handleUpdate as (patch: Partial<SMSNodeData>) => void}
            />
          )}
          {nodeData.type === "press_digit" && (
            <PressDigitEditor
              data={nodeData}
              allNodes={allNodes}
              onUpdate={handleUpdate as (patch: Partial<PressDigitNodeData>) => void}
            />
          )}
          {nodeData.type === "branch" && (
            <BranchEditor
              data={nodeData}
              allNodes={allNodes}
              onUpdate={handleUpdate as (patch: Partial<BranchNodeData>) => void}
            />
          )}
          {nodeData.type === "agent_swap" && (
            <AgentSwapEditor
              data={nodeData}
              allNodes={allNodes}
              onUpdate={handleUpdate as (patch: Partial<AgentSwapNodeData>) => void}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
