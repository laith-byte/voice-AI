"use client";

import { useCallback, useState } from "react";
import {
  X,
  Trash2,
  Plus,
  Pencil,
  Phone,
  PhoneForwarded,
  ArrowRightLeft,
  Hash,
  Calendar,
  MessageCircle,
  Braces,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type {
  PromptTreeNodeData,
  BeginTagNodeData,
  ConversationNodeData,
  EndNodeData,
  TransferCallNodeData,
  FunctionNodeData,
  SMSNodeData,
  PressDigitNodeData,
  BranchNodeData,
  AgentSwapNodeData,
  RetellEdge,
  ConversationFlowTool,
  ConversationFlowCustomTool,
} from "@/lib/prompt-tree-types";

// The sidebar is never shown for begin_tag nodes
type SidebarNodeData = Exclude<PromptTreeNodeData, BeginTagNodeData>;

// ─── Props ──────────────────────────────────────────────────────────────────

interface PromptTreeSidebarProps {
  nodeId: string;
  nodeData: SidebarNodeData;
  allNodes: Array<{ id: string; name: string }>;
  startNodeId: string | null;
  tools: ConversationFlowTool[];
  onUpdateNodeData: (nodeId: string, data: Partial<PromptTreeNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  onSetStartNode: (nodeId: string) => void;
  onUpdateTools: (tools: ConversationFlowTool[]) => void;
  onAddTool: (type: string) => void;
  onEditTool: (toolIndex: number) => void;
  onClose: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeEdgeId() {
  return `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeConditionId() {
  return `cond_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const TOOL_TYPE_OPTIONS = [
  { type: "end_call", label: "End Call", icon: Phone },
  { type: "transfer_call", label: "Call Transfer", icon: PhoneForwarded },
  { type: "agent_swap", label: "Agent Transfer", icon: ArrowRightLeft },
  { type: "press_digit", label: "Press Digit (IVR Navigation)", icon: Hash },
  {
    type: "check_availability_cal",
    label: "Check Calendar Availability (Cal.com)",
    icon: Calendar,
  },
  {
    type: "book_appointment_cal",
    label: "Book on the Calendar (Cal.com)",
    icon: Calendar,
  },
  { type: "send_sms", label: "Send SMS", icon: MessageCircle },
  { type: "extract_dynamic_variable", label: "Extract Variable", icon: Braces },
  { type: "custom", label: "Custom Function", icon: Settings },
] as const;

function getToolDisplayIcon(tool: ConversationFlowTool) {
  switch (tool.type) {
    case "custom":
      return Settings;
    case "check_availability_cal":
      return Calendar;
    case "book_appointment_cal":
      return Calendar;
    case "end_call":
      return Phone;
    case "transfer_call":
      return PhoneForwarded;
    case "agent_swap":
      return ArrowRightLeft;
    case "press_digit":
      return Hash;
    case "send_sms":
      return MessageCircle;
    case "extract_dynamic_variable":
      return Braces;
    default:
      return Settings;
  }
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
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-emerald-600 hover:text-emerald-700"
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
        <div
          key={edge.id}
          className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/50 p-3"
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <Input
                placeholder="Transition condition..."
                className="bg-white text-sm"
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
                <SelectTrigger className="w-full bg-white text-sm">
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
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onChange(edges.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-3.5" />
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
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input
        placeholder="Condition..."
        className="bg-white text-sm"
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
        <SelectTrigger className="w-full bg-white text-sm">
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

// ─── Tools Section ──────────────────────────────────────────────────────────

function ToolsSection({
  tools,
  onUpdateTools,
  onAddTool,
  onEditTool,
}: {
  tools: ConversationFlowTool[];
  onUpdateTools: (tools: ConversationFlowTool[]) => void;
  onAddTool: (type: string) => void;
  onEditTool: (toolIndex: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          Tools (Optional)
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-emerald-600 hover:text-emerald-700"
            >
              <Plus className="size-3" />
              Add
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {TOOL_TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <DropdownMenuItem
                  key={option.type}
                  onClick={() => onAddTool(option.type)}
                  className="gap-2.5 py-2"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm">{option.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Enable this state with capabilities such as calendar bookings, call
        termination, or your own custom functions.
      </p>
      {tools.length > 0 && (
        <div className="space-y-1">
          {tools.map((tool, index) => {
            const Icon = getToolDisplayIcon(tool);
            return (
              <div
                key={`tool-${index}`}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm text-foreground">
                  {tool.name || "Unnamed tool"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => onEditTool(index)}
                >
                  <Pencil className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    const updated = tools.filter((_, j) => j !== index);
                    onUpdateTools(updated);
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MCPs Section ───────────────────────────────────────────────────────────

function MCPsSection() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          MCPs (Optional)
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-emerald-600 hover:text-emerald-700"
        >
          <Plus className="size-3" />
          Add
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Connect Model Context Protocol servers to extend this state with
        external data sources and tools.
      </p>
    </div>
  );
}

// ─── Conversation Editor ────────────────────────────────────────────────────

function ConversationEditor({
  data,
  allNodes,
  tools,
  onUpdate,
  onUpdateTools,
  onAddTool,
  onEditTool,
}: {
  data: ConversationNodeData;
  allNodes: Array<{ id: string; name: string }>;
  tools: ConversationFlowTool[];
  onUpdate: (patch: Partial<ConversationNodeData>) => void;
  onUpdateTools: (tools: ConversationFlowTool[]) => void;
  onAddTool: (type: string) => void;
  onEditTool: (toolIndex: number) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Prompt */}
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">Prompt</span>
        <Textarea
          placeholder="Enter your prompt instructions here..."
          className="min-h-[200px] resize-y bg-white text-sm leading-relaxed"
          value={data.instruction.text}
          onChange={(e) =>
            onUpdate({
              instruction: { ...data.instruction, text: e.target.value },
            })
          }
        />
      </div>

      <Separator />

      {/* Tools */}
      <ToolsSection
        tools={tools}
        onUpdateTools={onUpdateTools}
        onAddTool={onAddTool}
        onEditTool={onEditTool}
      />

      <Separator />

      {/* MCPs */}
      <MCPsSection />

      <Separator />

      {/* Enable State Interruption Sensitivity */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="interruption-sensitivity"
          checked={data.interruption_sensitivity !== undefined}
          onCheckedChange={(checked) => {
            if (checked) {
              onUpdate({ interruption_sensitivity: 0.5 });
            } else {
              onUpdate({ interruption_sensitivity: undefined });
            }
          }}
        />
        <div className="space-y-1">
          <label
            htmlFor="interruption-sensitivity"
            className="text-sm font-medium leading-none text-foreground"
          >
            Enable State Interruption Sensitivity
          </label>
          {data.interruption_sensitivity !== undefined && (
            <Input
              type="number"
              min={0}
              max={1}
              step={0.1}
              className="mt-2 w-24 bg-white text-sm"
              value={data.interruption_sensitivity}
              onChange={(e) =>
                onUpdate({
                  interruption_sensitivity: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
          )}
        </div>
      </div>

      {/* Responsiveness */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Responsiveness</span>
          <span className="text-xs text-muted-foreground">{data.responsiveness ?? "Default"}</span>
        </div>
        <Input
          type="number"
          min={0}
          max={1}
          step={0.1}
          placeholder="0-1 (default)"
          className="bg-white text-sm"
          value={data.responsiveness ?? ""}
          onChange={(e) =>
            onUpdate({
              responsiveness: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
        <p className="text-xs text-muted-foreground">Controls how quickly the agent responds (0 = slower, 1 = faster).</p>
      </div>

      {/* Voice Speed */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Voice Speed</span>
          <span className="text-xs text-muted-foreground">{data.voice_speed ?? "Default"}</span>
        </div>
        <Input
          type="number"
          min={0.5}
          max={2}
          step={0.1}
          placeholder="0.5-2 (default 1)"
          className="bg-white text-sm"
          value={data.voice_speed ?? ""}
          onChange={(e) =>
            onUpdate({
              voice_speed: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
        <p className="text-xs text-muted-foreground">Speaking speed of the agent (0.5 = half speed, 2 = double speed).</p>
      </div>

      {/* Transitions */}
      {(data.edges?.length ?? 0) > 0 && (
        <>
          <Separator />
          <EdgeListSection
            edges={data.edges ?? []}
            allNodes={allNodes}
            onChange={(edges) => onUpdate({ edges })}
            label="Transitions"
          />
        </>
      )}
      {(data.edges?.length ?? 0) === 0 && (
        <>
          <Separator />
          <EdgeListSection
            edges={[]}
            allNodes={allNodes}
            onChange={(edges) => onUpdate({ edges })}
            label="Transitions"
          />
        </>
      )}
    </div>
  );
}

// ─── End Editor ─────────────────────────────────────────────────────────────

function EndEditor({
  data,
  onUpdate,
}: {
  data: EndNodeData;
  onUpdate: (patch: Partial<EndNodeData>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">End Call Message (Optional)</span>
        <Textarea
          placeholder="Optional message to say before ending the call..."
          className="min-h-24 bg-white text-sm"
          value={data.instruction?.text ?? ""}
          onChange={(e) =>
            onUpdate({
              instruction: e.target.value
                ? { text: e.target.value, type: "prompt" }
                : undefined,
            })
          }
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5">
        <span className="text-sm text-foreground">Speak During Execution</span>
        <Switch
          checked={data.speak_during_execution ?? false}
          onCheckedChange={(checked) =>
            onUpdate({ speak_during_execution: !!checked })
          }
        />
      </div>
    </div>
  );
}

// ─── Transfer Call Editor ───────────────────────────────────────────────────

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
  const transferType = data.transfer_option.type;
  return (
    <div className="space-y-5">
      {/* Transfer Destination */}
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">
          Transfer Destination
        </span>
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
          <SelectTrigger className="w-full bg-white text-sm">
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
            className="bg-white text-sm"
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
            className="min-h-20 bg-white text-sm"
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
        <span className="text-sm font-semibold text-foreground">
          Transfer Mode
        </span>
        <Select
          value={transferType}
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
          <SelectTrigger className="w-full bg-white text-sm">
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

      {/* Show Transferee as Caller */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5">
        <span className="text-sm text-foreground">Show Transferee as Caller</span>
        <Switch
          checked={data.transfer_option.show_transferee_as_caller ?? false}
          onCheckedChange={(checked) =>
            onUpdate({
              transfer_option: {
                ...data.transfer_option,
                show_transferee_as_caller: !!checked,
              },
            })
          }
        />
      </div>

      {/* Ignore E.164 Validation */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="ignore-e164"
          checked={data.ignore_e164_validation ?? false}
          onCheckedChange={(checked) =>
            onUpdate({ ignore_e164_validation: !!checked })
          }
        />
        <label
          htmlFor="ignore-e164"
          className="text-sm font-medium leading-none text-foreground"
        >
          Ignore E.164 Validation
        </label>
      </div>

      {/* Warm transfer specific options */}
      {transferType === "warm_transfer" && (
        <>
          <div className="space-y-2">
            <span className="text-sm font-semibold text-foreground">
              Agent Detection Timeout (ms)
            </span>
            <Input
              type="number"
              placeholder="e.g. 30000"
              className="bg-white text-sm"
              value={
                data.transfer_option.type === "warm_transfer"
                  ? (data.transfer_option.agent_detection_timeout_ms ?? "")
                  : ""
              }
              onChange={(e) =>
                onUpdate({
                  transfer_option: {
                    ...data.transfer_option,
                    type: "warm_transfer",
                    agent_detection_timeout_ms: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-semibold text-foreground">
              On Hold Music
            </span>
            <Select
              value={
                data.transfer_option.type === "warm_transfer"
                  ? (data.transfer_option.on_hold_music ?? "none")
                  : "none"
              }
              onValueChange={(val) =>
                onUpdate({
                  transfer_option: {
                    ...data.transfer_option,
                    type: "warm_transfer",
                    on_hold_music: val as "none" | "relaxing_sound" | "uplifting_beats" | "ringtone",
                  },
                })
              }
            >
              <SelectTrigger className="w-full bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="relaxing_sound">Relaxing Sound</SelectItem>
                <SelectItem value="uplifting_beats">Uplifting Beats</SelectItem>
                <SelectItem value="ringtone">Ringtone</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Agentic warm transfer on hold music */}
      {transferType === "agentic_warm_transfer" && (
        <div className="space-y-2">
          <span className="text-sm font-semibold text-foreground">
            On Hold Music
          </span>
          <Select
            value={
              data.transfer_option.type === "agentic_warm_transfer"
                ? (data.transfer_option.on_hold_music ?? "none")
                : "none"
            }
            onValueChange={(val) =>
              onUpdate({
                transfer_option: {
                  ...data.transfer_option,
                  type: "agentic_warm_transfer",
                  on_hold_music: val as "none" | "relaxing_sound" | "uplifting_beats" | "ringtone",
                },
              })
            }
          >
            <SelectTrigger className="w-full bg-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="relaxing_sound">Relaxing Sound</SelectItem>
              <SelectItem value="uplifting_beats">Uplifting Beats</SelectItem>
              <SelectItem value="ringtone">Ringtone</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Speak During Execution */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5">
        <span className="text-sm text-foreground">Speak During Execution</span>
        <Switch
          checked={data.speak_during_execution ?? false}
          onCheckedChange={(checked) =>
            onUpdate({ speak_during_execution: !!checked })
          }
        />
      </div>

      {/* Instruction */}
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">
          Instruction (Optional)
        </span>
        <Textarea
          placeholder="Optional instruction text..."
          className="min-h-20 bg-white text-sm"
          value={data.instruction?.text ?? ""}
          onChange={(e) =>
            onUpdate({
              instruction: e.target.value
                ? { text: e.target.value, type: "prompt" }
                : undefined,
            })
          }
        />
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

// ─── Function Editor ────────────────────────────────────────────────────────

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
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">Tool ID</span>
        <Input
          placeholder="tool_id..."
          className="bg-white text-sm"
          value={data.tool_id}
          onChange={(e) => onUpdate({ tool_id: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">Tool Type</span>
        <Select
          value={data.tool_type}
          onValueChange={(val) =>
            onUpdate({ tool_type: val as "local" | "shared" })
          }
        >
          <SelectTrigger className="w-full bg-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">Local</SelectItem>
            <SelectItem value="shared">Shared</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5">
        <span className="text-sm text-foreground">Wait for Result</span>
        <Switch
          checked={data.wait_for_result}
          onCheckedChange={(checked) =>
            onUpdate({ wait_for_result: !!checked })
          }
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5">
        <span className="text-sm text-foreground">
          Speak During Execution
        </span>
        <Switch
          checked={data.speak_during_execution ?? false}
          onCheckedChange={(checked) =>
            onUpdate({ speak_during_execution: !!checked })
          }
        />
      </div>

      {/* Optional instruction */}
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">
          Instruction (optional)
        </span>
        <Textarea
          placeholder="Instruction text..."
          className="min-h-20 bg-white text-sm"
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

// ─── SMS Editor ─────────────────────────────────────────────────────────────

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
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">
          SMS Content
        </span>
        <Textarea
          placeholder="Message content..."
          className="min-h-24 bg-white text-sm"
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

// ─── Press Digit Editor ─────────────────────────────────────────────────────

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
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">
          Instruction
        </span>
        <Textarea
          placeholder="Instruction text..."
          className="min-h-24 bg-white text-sm"
          value={data.instruction.text}
          onChange={(e) =>
            onUpdate({
              instruction: { text: e.target.value, type: "prompt" },
            })
          }
        />
      </div>
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">
          Delay (ms)
        </span>
        <Input
          type="number"
          placeholder="e.g. 1000"
          className="bg-white text-sm"
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

// ─── Branch Editor ──────────────────────────────────────────────────────────

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
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Conditions
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-emerald-600 hover:text-emerald-700"
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
          <div
            key={cond.id}
            className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/50 p-3"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Condition..."
                  className="bg-white text-sm"
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
                  <SelectTrigger className="w-full bg-white text-sm">
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
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  onUpdate({
                    conditions: conditions.filter((_, j) => j !== i),
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {conditions.length === 0 && (
          <p className="text-xs text-muted-foreground">No conditions yet.</p>
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

// ─── Agent Swap Editor ──────────────────────────────────────────────────────

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
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">Agent ID</span>
        <Input
          placeholder="agent_id..."
          className="bg-white text-sm"
          value={data.agent_id}
          onChange={(e) => onUpdate({ agent_id: e.target.value })}
        />
      </div>

      {/* Agent Version */}
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">Agent Version</span>
        <Input
          type="number"
          placeholder="Version number (optional)"
          className="bg-white text-sm"
          value={data.agent_version ?? ""}
          onChange={(e) =>
            onUpdate({
              agent_version: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </div>

      {/* Post-Call Analysis Setting */}
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">Post-Call Analysis Setting</span>
        <Select
          value={data.post_call_analysis_setting ?? "both_agents"}
          onValueChange={(val) =>
            onUpdate({
              post_call_analysis_setting: val as "both_agents" | "only_destination_agent",
            })
          }
        >
          <SelectTrigger className="w-full bg-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="both_agents">Both Agents</SelectItem>
            <SelectItem value="only_destination_agent">Only Destination Agent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Webhook Setting */}
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">Webhook Setting</span>
        <Select
          value={data.webhook_setting ?? "both_agents"}
          onValueChange={(val) =>
            onUpdate({
              webhook_setting: val as "both_agents" | "only_destination_agent" | "only_source_agent",
            })
          }
        >
          <SelectTrigger className="w-full bg-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="both_agents">Both Agents</SelectItem>
            <SelectItem value="only_destination_agent">Only Destination Agent</SelectItem>
            <SelectItem value="only_source_agent">Only Source Agent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Keep Current Voice */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5">
        <span className="text-sm text-foreground">Keep Current Voice</span>
        <Switch
          checked={data.keep_current_voice ?? false}
          onCheckedChange={(checked) =>
            onUpdate({ keep_current_voice: !!checked })
          }
        />
      </div>

      {/* Speak During Execution */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5">
        <span className="text-sm text-foreground">Speak During Execution</span>
        <Switch
          checked={data.speak_during_execution ?? false}
          onCheckedChange={(checked) =>
            onUpdate({ speak_during_execution: !!checked })
          }
        />
      </div>

      {/* Instruction */}
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">
          Instruction (Optional)
        </span>
        <Textarea
          placeholder="Optional instruction text..."
          className="min-h-20 bg-white text-sm"
          value={data.instruction?.text ?? ""}
          onChange={(e) =>
            onUpdate({
              instruction: e.target.value
                ? { text: e.target.value, type: "prompt" }
                : undefined,
            })
          }
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
  startNodeId,
  tools,
  onUpdateNodeData,
  onDeleteNode,
  onSetStartNode,
  onUpdateTools,
  onAddTool,
  onEditTool,
  onClose,
}: PromptTreeSidebarProps) {
  const [isEditingName, setIsEditingName] = useState(false);

  const handleUpdate = useCallback(
    (patch: Partial<PromptTreeNodeData>) => {
      onUpdateNodeData(nodeId, patch);
    },
    [nodeId, onUpdateNodeData],
  );

  const isStartNode = startNodeId === nodeId;

  return (
    <div className="flex h-full w-[400px] flex-col overflow-hidden border-l border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {isEditingName ? (
              <Input
                className="h-8 text-base font-semibold"
                value={nodeData.name}
                autoFocus
                onChange={(e) => handleUpdate({ name: e.target.value })}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setIsEditingName(false);
                }}
              />
            ) : (
              <button
                className="group flex min-w-0 items-center gap-1.5"
                onClick={() => setIsEditingName(true)}
              >
                <h2 className="truncate text-base font-semibold text-foreground">
                  {nodeData.name}
                </h2>
                <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDeleteNode(nodeId)}
              title="Delete node"
            >
              <Trash2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              title="Close sidebar"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Set as starting state link */}
        {!isStartNode && (
          <button
            className="mt-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
            onClick={() => onSetStartNode(nodeId)}
          >
            Set as a starting state
          </button>
        )}
        {isStartNode && (
          <span className="mt-2 inline-block text-xs font-medium text-emerald-600">
            Starting state
          </span>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="px-5 py-5">
          {nodeData.type === "conversation" && (
            <ConversationEditor
              data={nodeData}
              allNodes={allNodes}
              tools={tools}
              onUpdate={
                handleUpdate as (
                  patch: Partial<ConversationNodeData>,
                ) => void
              }
              onUpdateTools={onUpdateTools}
              onAddTool={onAddTool}
              onEditTool={onEditTool}
            />
          )}
          {nodeData.type === "end" && (
            <EndEditor
              data={nodeData}
              onUpdate={handleUpdate as (patch: Partial<EndNodeData>) => void}
            />
          )}
          {nodeData.type === "transfer_call" && (
            <TransferCallEditor
              data={nodeData}
              allNodes={allNodes}
              onUpdate={
                handleUpdate as (
                  patch: Partial<TransferCallNodeData>,
                ) => void
              }
            />
          )}
          {nodeData.type === "function" && (
            <FunctionEditor
              data={nodeData}
              allNodes={allNodes}
              onUpdate={
                handleUpdate as (
                  patch: Partial<FunctionNodeData>,
                ) => void
              }
            />
          )}
          {nodeData.type === "sms" && (
            <SMSEditor
              data={nodeData}
              allNodes={allNodes}
              onUpdate={
                handleUpdate as (patch: Partial<SMSNodeData>) => void
              }
            />
          )}
          {nodeData.type === "press_digit" && (
            <PressDigitEditor
              data={nodeData}
              allNodes={allNodes}
              onUpdate={
                handleUpdate as (
                  patch: Partial<PressDigitNodeData>,
                ) => void
              }
            />
          )}
          {nodeData.type === "branch" && (
            <BranchEditor
              data={nodeData}
              allNodes={allNodes}
              onUpdate={
                handleUpdate as (
                  patch: Partial<BranchNodeData>,
                ) => void
              }
            />
          )}
          {nodeData.type === "agent_swap" && (
            <AgentSwapEditor
              data={nodeData}
              allNodes={allNodes}
              onUpdate={
                handleUpdate as (
                  patch: Partial<AgentSwapNodeData>,
                ) => void
              }
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
