"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, List, HelpCircle, PhoneCall, X } from "lucide-react";

interface QuickFixModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (step: number) => void;
}

const QUICK_FIX_OPTIONS = [
  {
    label: "Business Hours",
    description: "Change your open/close times or days off",
    icon: Clock,
    step: 3,
  },
  {
    label: "Services & Pricing",
    description: "Add, remove, or edit services your agent knows about",
    icon: List,
    step: 3,
  },
  {
    label: "FAQs & Policies",
    description: "Update answers to common questions",
    icon: HelpCircle,
    step: 3,
  },
  {
    label: "Call Handling",
    description: "Change after-hours behavior, max duration, or escalation",
    icon: PhoneCall,
    step: 4,
  },
];

export function QuickFixModal({ open, onClose, onNavigate }: QuickFixModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Fix</DialogTitle>
          <DialogDescription>
            Jump to a specific setting to make changes, then come back to test
            again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {QUICK_FIX_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  onClose();
                  onNavigate(option.step);
                }}
                className="w-full flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition-all hover:border-primary/30 hover:bg-primary/[0.03]"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1">
            <X className="w-3 h-3" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
