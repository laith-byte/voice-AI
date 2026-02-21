"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  MessageSquare,
  PhoneOff,
  PhoneForwarded,
  Wrench,
  MessageCircle,
  Hash,
  GitBranch,
  ArrowRightLeft,
  Play,
} from "lucide-react";
import type {
  ConversationNodeData,
  EndNodeData,
  TransferCallNodeData,
  FunctionNodeData,
  SMSNodeData,
  PressDigitNodeData,
  BranchNodeData,
  AgentSwapNodeData,
  BeginTagNodeData,
} from "@/lib/prompt-tree-types";
import { cn } from "@/lib/utils";

// ─── Node type aliases ──────────────────────────────────────────────────────

type ConversationFlowNode = Node<ConversationNodeData, "conversation">;
type EndFlowNode = Node<EndNodeData, "end">;
type TransferCallFlowNode = Node<TransferCallNodeData, "transfer_call">;
type FunctionFlowNode = Node<FunctionNodeData, "function">;
type SMSFlowNode = Node<SMSNodeData, "sms">;
type PressDigitFlowNode = Node<PressDigitNodeData, "press_digit">;
type BranchFlowNode = Node<BranchNodeData, "branch">;
type AgentSwapFlowNode = Node<AgentSwapNodeData, "agent_swap">;
type BeginTagFlowNode = Node<BeginTagNodeData, "begin_tag">;

// ─── Shared styles ──────────────────────────────────────────────────────────

const handleStyle =
  "!w-3 !h-3 !bg-white !border-2 !rounded-full hover:!scale-125 transition-transform";

function NodeShell({
  children,
  selected,
  accentColor,
}: {
  children: React.ReactNode;
  selected?: boolean;
  accentColor: string;
}) {
  return (
    <div
      className={cn(
        "w-[260px] rounded-xl bg-white shadow-md transition-shadow",
        "border border-gray-200",
        selected && "ring-2 ring-offset-1 shadow-lg",
        selected && accentColor
      )}
    >
      {children}
    </div>
  );
}

function NodeHeader({
  icon: Icon,
  name,
  badge,
  bgClass,
  textClass,
  iconClass,
}: {
  icon: React.ElementType;
  name: string;
  badge: string;
  bgClass: string;
  textClass: string;
  iconClass: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 rounded-t-xl px-3.5 py-2.5", bgClass)}>
      <div className={cn("flex items-center justify-center rounded-md p-1", iconClass)}>
        <Icon className="size-3.5 text-white" />
      </div>
      <span className={cn("flex-1 text-sm font-semibold truncate", textClass)}>
        {name}
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
          iconClass,
          "text-white"
        )}
      >
        {badge}
      </span>
    </div>
  );
}

// ─── ConversationNode ───────────────────────────────────────────────────────

const ConversationNode = memo(function ConversationNode({
  data,
  selected,
}: NodeProps<ConversationFlowNode>) {
  const text = data.instruction?.text ?? "";
  const edgeCount = data.edges?.length ?? 0;
  return (
    <NodeShell selected={selected} accentColor="ring-blue-500">
      <Handle
        type="target"
        position={Position.Top}
        className={cn(handleStyle, "!border-blue-500")}
      />
      <NodeHeader
        icon={MessageSquare}
        name={data.name || "Conversation"}
        badge="Conversation"
        bgClass="bg-blue-50"
        textClass="text-blue-900"
        iconClass="bg-blue-500"
      />
      <div className="px-3.5 py-3 space-y-2">
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
          {text || "No instruction set"}
        </p>
        {edgeCount > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400">
              {edgeCount} transition{edgeCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(handleStyle, "!border-blue-500")}
      />
    </NodeShell>
  );
});

// ─── EndNode ────────────────────────────────────────────────────────────────

const EndNode = memo(function EndNode({
  data,
  selected,
}: NodeProps<EndFlowNode>) {
  return (
    <NodeShell selected={selected} accentColor="ring-red-500">
      <Handle
        type="target"
        position={Position.Top}
        className={cn(handleStyle, "!border-red-500")}
      />
      <NodeHeader
        icon={PhoneOff}
        name={data.name || "End Call"}
        badge="End"
        bgClass="bg-red-50"
        textClass="text-red-900"
        iconClass="bg-red-500"
      />
      <div className="px-3.5 py-3">
        <p className="text-xs text-gray-500">
          Ends the call and disconnects.
        </p>
      </div>
    </NodeShell>
  );
});

// ─── TransferCallNode ───────────────────────────────────────────────────────

const TransferCallNode = memo(function TransferCallNode({
  data,
  selected,
}: NodeProps<TransferCallFlowNode>) {
  const dest = data.transfer_destination;
  const label =
    dest?.type === "predefined"
      ? dest.number || "No number"
      : "Inferred from prompt";
  const mode = data.transfer_option?.type?.replace(/_/g, " ") ?? "cold transfer";
  return (
    <NodeShell selected={selected} accentColor="ring-orange-500">
      <Handle
        type="target"
        position={Position.Top}
        className={cn(handleStyle, "!border-orange-500")}
      />
      <NodeHeader
        icon={PhoneForwarded}
        name={data.name || "Transfer Call"}
        badge="Transfer"
        bgClass="bg-orange-50"
        textClass="text-orange-900"
        iconClass="bg-orange-500"
      />
      <div className="px-3.5 py-3 space-y-1.5">
        <p className="text-xs text-gray-600 truncate">{label}</p>
        <p className="text-[10px] text-gray-400 capitalize">{mode}</p>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(handleStyle, "!border-orange-500")}
      />
    </NodeShell>
  );
});

// ─── FunctionNode ───────────────────────────────────────────────────────────

const FunctionNode = memo(function FunctionNode({
  data,
  selected,
}: NodeProps<FunctionFlowNode>) {
  return (
    <NodeShell selected={selected} accentColor="ring-purple-500">
      <Handle
        type="target"
        position={Position.Top}
        className={cn(handleStyle, "!border-purple-500")}
      />
      <NodeHeader
        icon={Wrench}
        name={data.name || "Function"}
        badge="Function"
        bgClass="bg-purple-50"
        textClass="text-purple-900"
        iconClass="bg-purple-500"
      />
      <div className="px-3.5 py-3 space-y-1.5">
        <p className="text-xs text-gray-600 truncate">
          {data.tool_id || "No tool selected"}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">
            {data.wait_for_result ? "Wait for result" : "Fire and forget"}
          </span>
          {data.speak_during_execution && (
            <span className="text-[10px] text-purple-500">Speaks</span>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(handleStyle, "!border-purple-500")}
      />
    </NodeShell>
  );
});

// ─── SMSNode ────────────────────────────────────────────────────────────────

const SMSNode = memo(function SMSNode({
  data,
  selected,
}: NodeProps<SMSFlowNode>) {
  const text = data.sms_content ?? "";
  return (
    <NodeShell selected={selected} accentColor="ring-emerald-500">
      <Handle
        type="target"
        position={Position.Top}
        className={cn(handleStyle, "!border-emerald-500")}
      />
      <NodeHeader
        icon={MessageCircle}
        name={data.name || "Send SMS"}
        badge="SMS"
        bgClass="bg-emerald-50"
        textClass="text-emerald-900"
        iconClass="bg-emerald-500"
      />
      <div className="px-3.5 py-3">
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
          {text || "No message content"}
        </p>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(handleStyle, "!border-emerald-500")}
      />
    </NodeShell>
  );
});

// ─── PressDigitNode ─────────────────────────────────────────────────────────

const PressDigitNode = memo(function PressDigitNode({
  data,
  selected,
}: NodeProps<PressDigitFlowNode>) {
  const text = data.instruction?.text ?? "";
  return (
    <NodeShell selected={selected} accentColor="ring-indigo-500">
      <Handle
        type="target"
        position={Position.Top}
        className={cn(handleStyle, "!border-indigo-500")}
      />
      <NodeHeader
        icon={Hash}
        name={data.name || "Press Digit"}
        badge="DTMF"
        bgClass="bg-indigo-50"
        textClass="text-indigo-900"
        iconClass="bg-indigo-500"
      />
      <div className="px-3.5 py-3 space-y-1.5">
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
          {text || "No instruction"}
        </p>
        {data.delay_ms && (
          <p className="text-[10px] text-gray-400">
            Delay: {data.delay_ms}ms
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(handleStyle, "!border-indigo-500")}
      />
    </NodeShell>
  );
});

// ─── BranchNode ─────────────────────────────────────────────────────────────

const BranchNode = memo(function BranchNode({
  data,
  selected,
}: NodeProps<BranchFlowNode>) {
  const count = data.conditions?.length ?? 0;
  return (
    <NodeShell selected={selected} accentColor="ring-amber-500">
      <Handle
        type="target"
        position={Position.Top}
        className={cn(handleStyle, "!border-amber-500")}
      />
      <NodeHeader
        icon={GitBranch}
        name={data.name || "Branch"}
        badge="Branch"
        bgClass="bg-amber-50"
        textClass="text-amber-900"
        iconClass="bg-amber-500"
      />
      <div className="px-3.5 py-3 space-y-1">
        <p className="text-xs text-gray-600">
          {count} condition{count !== 1 ? "s" : ""}
        </p>
        {data.else_edge && (
          <p className="text-[10px] text-gray-400">+ else fallback</p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(handleStyle, "!border-amber-500")}
      />
    </NodeShell>
  );
});

// ─── AgentSwapNode ──────────────────────────────────────────────────────────

const AgentSwapNode = memo(function AgentSwapNode({
  data,
  selected,
}: NodeProps<AgentSwapFlowNode>) {
  return (
    <NodeShell selected={selected} accentColor="ring-teal-500">
      <Handle
        type="target"
        position={Position.Top}
        className={cn(handleStyle, "!border-teal-500")}
      />
      <NodeHeader
        icon={ArrowRightLeft}
        name={data.name || "Agent Swap"}
        badge="Swap"
        bgClass="bg-teal-50"
        textClass="text-teal-900"
        iconClass="bg-teal-500"
      />
      <div className="px-3.5 py-3">
        <p className="text-xs text-gray-600 truncate">
          {data.agent_id || "No agent selected"}
        </p>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(handleStyle, "!border-teal-500")}
      />
    </NodeShell>
  );
});

// ─── BeginTagNode ───────────────────────────────────────────────────────────

const BeginTagNode = memo(function BeginTagNode({
  data,
}: NodeProps<BeginTagFlowNode>) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 shadow-md">
        <Play className="size-3.5 text-white fill-white" />
        <span className="text-sm font-semibold text-white">Begin</span>
      </div>
      <span className="text-[10px] text-gray-400 font-medium">
        {data.startSpeaker === "agent" ? "Agent speaks first" : "User speaks first"}
      </span>
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(handleStyle, "!border-emerald-500")}
      />
    </div>
  );
});

// ─── Node type registry ─────────────────────────────────────────────────────

export const nodeTypes = {
  conversation: ConversationNode,
  end: EndNode,
  transfer_call: TransferCallNode,
  function: FunctionNode,
  sms: SMSNode,
  press_digit: PressDigitNode,
  branch: BranchNode,
  agent_swap: AgentSwapNode,
  begin_tag: BeginTagNode,
} as const;
