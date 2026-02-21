"use client";

import { useState } from "react";
import {
  Plus,
  Save,
  Loader2,
  Check,
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
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;
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
  color: string;
}> = [
  { type: "conversation", label: "Conversation", icon: MessageSquare, color: "text-blue-600" },
  { type: "end", label: "End Call", icon: PhoneOff, color: "text-red-600" },
  { type: "transfer_call", label: "Transfer Call", icon: PhoneForwarded, color: "text-orange-600" },
  { type: "function", label: "Function", icon: Wrench, color: "text-purple-600" },
  { type: "sms", label: "Send SMS", icon: MessageCircle, color: "text-emerald-600" },
  { type: "press_digit", label: "Press Digit", icon: Hash, color: "text-indigo-600" },
  { type: "branch", label: "Branch", icon: GitBranch, color: "text-amber-600" },
  { type: "agent_swap", label: "Agent Swap", icon: ArrowRightLeft, color: "text-teal-600" },
];

const MODEL_OPTIONS: Array<{ value: ModelChoice["model"]; label: string }> = [
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  { value: "claude-4.5-sonnet", label: "Claude 4.5 Sonnet" },
  { value: "claude-4.5-haiku", label: "Claude 4.5 Haiku" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function PromptTreeToolbar({
  onAddNode,
  onSave,
  saving,
  lastSavedAt,
  hasUnsavedChanges,
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
    <div className="flex items-center gap-2 border-b bg-white px-4 py-2.5">
      {/* Add Node */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Add Node
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {NODE_TYPE_MENU_ITEMS.map((item) => (
            <DropdownMenuItem
              key={item.type}
              onClick={() => onAddNode(item.type)}
              className="gap-2.5"
            >
              <item.icon className={`size-4 ${item.color}`} />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save */}
      <Button
        variant="outline"
        size="sm"
        onClick={onSave}
        disabled={saving}
        className="gap-1.5"
      >
        {saving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </>
        ) : hasUnsavedChanges ? (
          <>
            <Save className="size-4" />
            Save
          </>
        ) : (
          <>
            <Check className="size-4 text-green-600" />
            Saved
          </>
        )}
      </Button>

      {lastSavedAt && !hasUnsavedChanges && !saving && (
        <span className="text-[11px] text-gray-400">
          {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}

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
          <Button variant="outline" size="sm" className="gap-1.5">
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
            ...modelChoice,
            model: val as ModelChoice["model"],
            type: "cascading",
          })
        }
      >
        <SelectTrigger size="sm" className="w-48">
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
      <div className="flex items-center rounded-lg border bg-gray-50 p-0.5">
        <button
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            startSpeaker === "agent"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => onStartSpeakerChange("agent")}
        >
          Agent First
        </button>
        <button
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            startSpeaker === "user"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => onStartSpeakerChange("user")}
        >
          User First
        </button>
      </div>
    </div>
  );
}
