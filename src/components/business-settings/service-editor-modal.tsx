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

export interface ServiceData {
  id: string;
  name: string;
  description: string | null;
  price_text: string | null;
  duration_text: string | null;
  ai_notes: string | null;
}

interface ServiceEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: ServiceData | null;
  clientId?: string;
  onSaved: () => void;
}

function apiUrl(path: string, clientId?: string) {
  const base = `/api/business-settings${path}`;
  return clientId ? `${base}?client_id=${clientId}` : base;
}

export function ServiceEditorModal({
  open,
  onOpenChange,
  service,
  clientId,
  onSaved,
}: ServiceEditorModalProps) {
  const isEditMode = !!service;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [aiNotes, setAiNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Populate form when service changes
  useEffect(() => {
    if (service) {
      setName(service.name ?? "");
      setDescription(service.description ?? "");
      setPrice(service.price_text ?? "");
      setDuration(service.duration_text ?? "");
      setAiNotes(service.ai_notes ?? "");
    } else {
      setName("");
      setDescription("");
      setPrice("");
      setDuration("");
      setAiNotes("");
    }
  }, [service, open]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Service name is required");
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      price_text: price.trim() || null,
      duration_text: duration.trim() || null,
      ai_notes: aiNotes.trim() || null,
    };

    try {
      let res: Response;
      if (isEditMode && service) {
        res = await fetch(apiUrl(`/services/${service.id}`, clientId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(apiUrl("/services", clientId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? "Failed to save service");
      }

      toast.success(
        isEditMode ? "Service updated successfully" : "Service created successfully"
      );
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save service"
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
            {isEditMode ? "Edit Service" : "Add Service"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Oil Change, Consultation, Haircut"
              className="text-sm"
            />
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              Description
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this service..."
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Price / Rate
              </Label>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. $50, $100/hr"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Duration
              </Label>
              <Input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 30 min, 1 hour"
                className="text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              AI Notes
            </Label>
            <Textarea
              value={aiNotes}
              onChange={(e) => setAiNotes(e.target.value)}
              placeholder="Additional context for the AI agent about this service..."
              rows={2}
              className="text-sm resize-none"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              These notes help the AI agent describe and recommend this service
              accurately.
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
            {isEditMode ? "Update Service" : "Add Service"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
