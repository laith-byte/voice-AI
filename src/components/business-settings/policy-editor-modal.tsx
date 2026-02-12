"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface PolicyData {
  id: string;
  name: string;
  description: string;
}

interface PolicyEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: PolicyData | null;
  clientId?: string;
  onSaved: () => void;
}

function apiUrl(path: string, clientId?: string) {
  const base = `/api/business-settings${path}`;
  return clientId ? `${base}?client_id=${clientId}` : base;
}

export function PolicyEditorModal({
  open,
  onOpenChange,
  policy,
  clientId,
  onSaved,
}: PolicyEditorModalProps) {
  const isEditMode = !!policy;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Populate form when policy changes
  useEffect(() => {
    if (policy) {
      setName(policy.name ?? "");
      setDescription(policy.description ?? "");
    } else {
      setName("");
      setDescription("");
    }
  }, [policy, open]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Policy name is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Policy description is required");
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
    };

    try {
      let res: Response;
      if (isEditMode && policy) {
        res = await fetch(apiUrl(`/policies/${policy.id}`, clientId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(apiUrl("/policies", clientId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? "Failed to save policy");
      }

      toast.success(
        isEditMode
          ? "Policy updated successfully"
          : "Policy created successfully"
      );
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save policy"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Policy" : "Add Policy"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              Policy Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cancellation Policy, Refund Policy"
              className="text-sm"
            />
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your policy in detail..."
              rows={6}
              className="text-sm resize-none"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Provide enough detail so the AI agent can accurately communicate
              this policy to callers.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditMode ? "Update Policy" : "Add Policy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
