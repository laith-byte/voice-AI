"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type {
  ConversationNodeData,
  EndNodeData,
  TransferCallNodeData,
  FunctionNodeData,
  SMSNodeData,
  PressDigitNodeData,
  BranchNodeData,
  AgentSwapNodeData,
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

// ─── Shared wrapper ─────────────────────────────────────────────────────────

function NodeShell({
  children,
  selected,
  borderColor,
}: {
  children: React.ReactNode;
  selected?: boolean;
  borderColor: string;
}) {
  return (
    <div
      className={cn(
        "w-[200px] rounded-lg border-2 bg-card text-card-foreground shadow-sm",
        borderColor,
        selected && "ring-2 ring-blue-500"
      )}
    >
      {children}
    </div>
  );
}

function NodeHeader({
  name,
  badge,
  badgeClass,
}: {
  name: string;
  badge: string;
  badgeClass: string;
}) {
  return (
    <div className="flex items-center justify-between gap-1 px-3 py-2 border-b">
      <span className="text-xs font-semibold truncate">{name}</span>
      <span
        className={cn(
          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
          badgeClass
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
  return (
    <NodeShell selected={selected} borderColor="border-blue-400">
      <Handle type="target" position={Position.Top} className="!bg-blue-400" />
      <NodeHeader
        name={data.name || "Conversation"}
        badge="Conversation"
        badgeClass="bg-blue-100 text-blue-700"
      />
      <div className="px-3 py-2">
        <p className="text-[11px] text-muted-foreground leading-snug">
          {text.length > 80 ? text.slice(0, 80) + "..." : text || "No instruction"}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400" />
    </NodeShell>
  );
});

// ─── EndNode ────────────────────────────────────────────────────────────────

const EndNode = memo(function EndNode({
  data,
  selected,
}: NodeProps<EndFlowNode>) {
  return (
    <NodeShell selected={selected} borderColor="border-red-400">
      <Handle type="target" position={Position.Top} className="!bg-red-400" />
      <NodeHeader
        name={data.name || "End Call"}
        badge="End"
        badgeClass="bg-red-100 text-red-700"
      />
      <div className="px-3 py-2">
        <p className="text-[11px] text-muted-foreground">
          Ends the call.
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
    dest?.type === "predefined" ? dest.number : "Inferred";
  return (
    <NodeShell selected={selected} borderColor="border-orange-400">
      <Handle type="target" position={Position.Top} className="!bg-orange-400" />
      <NodeHeader
        name={data.name || "Transfer Call"}
        badge="Transfer"
        badgeClass="bg-orange-100 text-orange-700"
      />
      <div className="px-3 py-2">
        <p className="text-[11px] text-muted-foreground truncate">
          {label}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-400" />
    </NodeShell>
  );
});

// ─── FunctionNode ───────────────────────────────────────────────────────────

const FunctionNode = memo(function FunctionNode({
  data,
  selected,
}: NodeProps<FunctionFlowNode>) {
  return (
    <NodeShell selected={selected} borderColor="border-purple-400">
      <Handle type="target" position={Position.Top} className="!bg-purple-400" />
      <NodeHeader
        name={data.name || "Function"}
        badge="Function"
        badgeClass="bg-purple-100 text-purple-700"
      />
      <div className="px-3 py-2">
        <p className="text-[11px] text-muted-foreground truncate">
          {data.tool_id || "No tool selected"}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-400" />
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
    <NodeShell selected={selected} borderColor="border-green-400">
      <Handle type="target" position={Position.Top} className="!bg-green-400" />
      <NodeHeader
        name={data.name || "SMS"}
        badge="SMS"
        badgeClass="bg-green-100 text-green-700"
      />
      <div className="px-3 py-2">
        <p className="text-[11px] text-muted-foreground leading-snug">
          {text.length > 80 ? text.slice(0, 80) + "..." : text || "No content"}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-400" />
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
    <NodeShell selected={selected} borderColor="border-indigo-400">
      <Handle type="target" position={Position.Top} className="!bg-indigo-400" />
      <NodeHeader
        name={data.name || "Press Digit"}
        badge="Digit"
        badgeClass="bg-indigo-100 text-indigo-700"
      />
      <div className="px-3 py-2">
        <p className="text-[11px] text-muted-foreground leading-snug">
          {text.length > 80 ? text.slice(0, 80) + "..." : text || "No instruction"}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400" />
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
    <NodeShell selected={selected} borderColor="border-yellow-400">
      <Handle type="target" position={Position.Top} className="!bg-yellow-400" />
      <NodeHeader
        name={data.name || "Branch"}
        badge="Branch"
        badgeClass="bg-yellow-100 text-yellow-700"
      />
      <div className="px-3 py-2">
        <p className="text-[11px] text-muted-foreground">
          {count} condition{count !== 1 ? "s" : ""}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-400" />
    </NodeShell>
  );
});

// ─── AgentSwapNode ──────────────────────────────────────────────────────────

const AgentSwapNode = memo(function AgentSwapNode({
  data,
  selected,
}: NodeProps<AgentSwapFlowNode>) {
  return (
    <NodeShell selected={selected} borderColor="border-teal-400">
      <Handle type="target" position={Position.Top} className="!bg-teal-400" />
      <NodeHeader
        name={data.name || "Agent Swap"}
        badge="Swap"
        badgeClass="bg-teal-100 text-teal-700"
      />
      <div className="px-3 py-2">
        <p className="text-[11px] text-muted-foreground truncate">
          {data.agent_id || "No agent selected"}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-teal-400" />
    </NodeShell>
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
} as const;
