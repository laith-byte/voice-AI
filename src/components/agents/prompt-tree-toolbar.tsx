"use client";

import { useState } from "react";
import {
  Plus,
  Save,
  Loader2,
  MessageSquare,
  PhoneOff,
  PhoneForwarded,
  Wrench,
  MessageCircle,
  Hash,
  GitBranch,
  ArrowRightLeft,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { PromptTreeNodeType, ModelChoice } from "@/lib/prompt-tree-types";

// ─── Props ──────────────────────────────────────────────────────────────────

interface PromptTreeToolbarProps {
  onAddNode: (type: PromptTreeNodeType) => void;
  onSave: () => void;
  saving: boolean;
  globalPrompt: string | null;
  onGlobalPromptChange: (prompt: string | null) => void;
  modelChoice: ModelChoice | undefined;
  onModelChoiceChange: (model: ModelChoice) => void;
  startSpeaker: "user" | "agent";
  onStartSpeakerChange: (speaker: "user" | "agent") => void;
}

// ─── Node type menu items ───────────────────────────────────────────────────

const NODE_TYPE_MENU_ITEMS: Array<{
  type: PromptTreeNodeType;
  label: string;
  icon: React.ElementType;
}> = [
  { type: "conversation", label: "Conversation", icon: MessageSquare },
  { type: "end", label: "End Call", icon: PhoneOff },
  { type: "transfer_call", label: "Transfer Call", icon: PhoneForwarded },
  { type: "function", label: "Function", icon: Wrench },
  { type: "sms", label: "Send SMS", icon: MessageCircle },
  { type: "press_digit", label: "Press Digit", icon: Hash },
  { type: "branch", label: "Branch", icon: GitBranch },
  { type: "agent_swap", label: "Agent Swap", icon: ArrowRightLeft },
];

const MODEL_OPTIONS: Array<{ value: ModelChoice["model"]; label: string }> = [
  { value: "gpt-4.1", label: "gpt-4.1" },
  { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
  { value: "gpt-4.1-nano", label: "gpt-4.1-nano" },
  { value: "claude-4.5-sonnet", label: "claude-4.5-sonnet" },
  { value: "claude-4.5-haiku", label: "claude-4.5-haiku" },
  { value: "gemini-2.5-flash", label: "gemini-2.5-flash" },
  { value: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function PromptTreeToolbar({
  onAddNode,
  onSave,
  saving,
  globalPrompt,
  onGlobalPromptChange,
  modelChoice,
  onModelChoiceChange,
  startSpeaker,
  onStartSpeakerChange,
}: PromptTreeToolbarProps) {
  const [globalPromptOpen, setGlobalPromptOpen] = useState(false);
  const [draftGlobalPrompt, setDraftGlobalPrompt] = useState(
    globalPrompt ?? ""
  );

  return (
    <div className="flex items-center gap-2 border-b bg-background px-4 py-2">
      {/* Add Node */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="size-4" />
            Add Node
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {NODE_TYPE_MENU_ITEMS.map((item) => (
            <DropdownMenuItem
              key={item.type}
              onClick={() => onAddNode(item.type)}
            >
              <item.icon className="size-4" />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save */}
      <Button size="sm" onClick={onSave} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="size-4" />
            Save
          </>
        )}
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Global Prompt */}
      <Dialog
        open={globalPromptOpen}
        onOpenChange={(open) => {
          setGlobalPromptOpen(open);
          if (open) {
            setDraftGlobalPrompt(globalPrompt ?? "");
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Globe className="size-4" />
            Global Prompt
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Global Prompt</DialogTitle>
            <DialogDescription>
              This prompt is applied to all conversation nodes as a system-level
              instruction.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-40"
            placeholder="Enter global prompt..."
            value={draftGlobalPrompt}
            onChange={(e) => setDraftGlobalPrompt(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGlobalPromptOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                onGlobalPromptChange(
                  draftGlobalPrompt.trim() ? draftGlobalPrompt.trim() : null
                );
                setGlobalPromptOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Model Selector */}
      <Select
        value={modelChoice?.model ?? "gpt-4.1"}
        onValueChange={(val) =>
          onModelChoiceChange({
            model: val as ModelChoice["model"],
            type: "cascading",
          })
        }
      >
        <SelectTrigger size="sm" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MODEL_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Start Speaker Toggle */}
      <div className="flex items-center rounded-md border">
        <Button
          variant={startSpeaker === "agent" ? "default" : "ghost"}
          size="sm"
          className="rounded-r-none"
          onClick={() => onStartSpeakerChange("agent")}
        >
          Agent First
        </Button>
        <Button
          variant={startSpeaker === "user" ? "default" : "ghost"}
          size="sm"
          className="rounded-l-none"
          onClick={() => onStartSpeakerChange("user")}
        >
          User First
        </Button>
      </div>
    </div>
  );
}
