"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  HelpCircle,
  GitBranch,
  PhoneForwarded,
  XCircle,
  Calendar,
  Search,
  Webhook,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { FlowNode } from "@/lib/conversation-flow-templates";

// ---------------------------------------------------------------------------
// Node type → icon + color mapping (mirrors prompt-tree-nodes.tsx patterns)
// ---------------------------------------------------------------------------

const NODE_META: Record<
  FlowNode["type"],
  { icon: React.ElementType; label: string; color: string; bgColor: string }
> = {
  message: {
    icon: MessageSquare,
    label: "Message",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  question: {
    icon: HelpCircle,
    label: "Question",
    color: "text-violet-600",
    bgColor: "bg-violet-50",
  },
  condition: {
    icon: GitBranch,
    label: "Condition",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  transfer: {
    icon: PhoneForwarded,
    label: "Transfer",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  end: {
    icon: XCircle,
    label: "End",
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
  check_availability: {
    icon: Calendar,
    label: "Check Availability",
    color: "text-teal-600",
    bgColor: "bg-teal-50",
  },
  book_appointment: {
    icon: CheckCircle2,
    label: "Book Appointment",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  crm_lookup: {
    icon: Search,
    label: "CRM Lookup",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  webhook: {
    icon: Webhook,
    label: "Webhook",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
};

// Node types that users can edit content for
const EDITABLE_TYPES = new Set<FlowNode["type"]>([
  "message",
  "question",
  "end",
  "transfer",
]);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConversationFlowEditorProps {
  nodes: FlowNode[];
  onNodesChange: (nodes: FlowNode[]) => void;
  industryKey: string;
  useCaseKey: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConversationFlowEditor({
  nodes,
  onNodesChange,
}: ConversationFlowEditorProps) {
  const [expandedInfra, setExpandedInfra] = useState<Set<string>>(new Set());

  function updateNodeText(nodeId: string, text: string) {
    onNodesChange(
      nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, text } } : n
      )
    );
  }

  function updateOptionLabel(
    nodeId: string,
    optionIndex: number,
    label: string
  ) {
    onNodesChange(
      nodes.map((n) => {
        if (n.id !== nodeId || !n.data.options) return n;
        const newOptions = n.data.options.map((opt, i) =>
          i === optionIndex ? { ...opt, label } : opt
        );
        return { ...n, data: { ...n.data, options: newOptions } };
      })
    );
  }

  function updateTransferNumber(nodeId: string, transferNumber: string) {
    onNodesChange(
      nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, transferNumber } }
          : n
      )
    );
  }

  function toggleInfra(nodeId: string) {
    setExpandedInfra((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {nodes.map((node, index) => {
        const meta = NODE_META[node.type];
        const Icon = meta.icon;
        const isEditable = EDITABLE_TYPES.has(node.type);
        const isInfra = !isEditable;
        const isExpanded = expandedInfra.has(node.id);

        return (
          <Card
            key={node.id}
            className={cn(
              "transition-all duration-200",
              isInfra && "opacity-80"
            )}
          >
            <CardContent className="p-4">
              {/* Header */}
              <div className="flex items-center gap-3 mb-2">
                {/* Step badge */}
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-gray-500">
                    {index + 1}
                  </span>
                </div>

                {/* Icon + label */}
                <div
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded-md",
                    meta.bgColor
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                  <span
                    className={cn("text-xs font-semibold", meta.color)}
                  >
                    {meta.label}
                  </span>
                </div>

                {/* Infrastructure toggle */}
                {isInfra && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => toggleInfra(node.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 mr-1" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 mr-1" />
                    )}
                    {isExpanded ? "Collapse" : "Details"}
                  </Button>
                )}
              </div>

              {/* Editable content */}
              {isEditable && (
                <div className="pl-10 space-y-3">
                  {/* Text content */}
                  {node.type !== "transfer" && (
                    <Textarea
                      value={node.data.text || ""}
                      onChange={(e) => updateNodeText(node.id, e.target.value)}
                      className="resize-none text-sm min-h-[60px]"
                      rows={3}
                      placeholder="Enter message text..."
                    />
                  )}

                  {/* Transfer number */}
                  {node.type === "transfer" && (
                    <div className="space-y-2">
                      {node.data.text && (
                        <Textarea
                          value={node.data.text}
                          onChange={(e) =>
                            updateNodeText(node.id, e.target.value)
                          }
                          className="resize-none text-sm min-h-[40px]"
                          rows={2}
                          placeholder="Transfer message..."
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <PhoneForwarded className="w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          value={node.data.transferNumber || ""}
                          onChange={(e) =>
                            updateTransferNumber(node.id, e.target.value)
                          }
                          placeholder="e.g. (555) 123-4567"
                          className="max-w-xs text-sm h-8"
                        />
                      </div>
                    </div>
                  )}

                  {/* Question options */}
                  {node.type === "question" && node.data.options && (
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Response options:
                      </span>
                      {node.data.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] w-5 h-5 flex items-center justify-center p-0 flex-shrink-0"
                          >
                            {String.fromCharCode(65 + i)}
                          </Badge>
                          <Input
                            value={opt.label}
                            onChange={(e) =>
                              updateOptionLabel(node.id, i, e.target.value)
                            }
                            className="text-sm h-8"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Infrastructure nodes — collapsed summary */}
              {isInfra && !isExpanded && (
                <div className="pl-10">
                  <p className="text-xs text-muted-foreground italic">
                    {node.type === "condition" &&
                      `Checks: ${node.data.condition || "condition logic"}`}
                    {node.type === "crm_lookup" && "Looks up caller in CRM"}
                    {node.type === "check_availability" &&
                      "Checks calendar availability"}
                    {node.type === "book_appointment" &&
                      "Books appointment for caller"}
                    {node.type === "webhook" &&
                      `Calls: ${node.data.webhookUrl || "webhook endpoint"}`}
                  </p>
                </div>
              )}

              {/* Infrastructure nodes — expanded detail (read-only) */}
              {isInfra && isExpanded && (
                <div className="pl-10 mt-2 space-y-2">
                  {node.data.text && (
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {node.data.text}
                      </p>
                    </div>
                  )}
                  {node.data.condition && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <GitBranch className="w-3 h-3" />
                      <span>
                        Condition: {node.data.condition}
                      </span>
                    </div>
                  )}
                  {node.data.webhookUrl && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Webhook className="w-3 h-3" />
                      <span>
                        {node.data.webhookMethod || "POST"}{" "}
                        {node.data.webhookUrl}
                      </span>
                    </div>
                  )}
                  {node.data.provider && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>Provider: {node.data.provider}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
