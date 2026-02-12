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

export interface FaqData {
  id: string;
  question: string;
  answer: string;
}

interface FaqEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faq?: FaqData | null;
  clientId?: string;
  onSaved: () => void;
}

function apiUrl(path: string, clientId?: string) {
  const base = `/api/business-settings${path}`;
  return clientId ? `${base}?client_id=${clientId}` : base;
}

export function FaqEditorModal({
  open,
  onOpenChange,
  faq,
  clientId,
  onSaved,
}: FaqEditorModalProps) {
  const isEditMode = !!faq;

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  // Populate form when faq changes
  useEffect(() => {
    if (faq) {
      setQuestion(faq.question ?? "");
      setAnswer(faq.answer ?? "");
    } else {
      setQuestion("");
      setAnswer("");
    }
  }, [faq, open]);

  async function handleSave() {
    if (!question.trim()) {
      toast.error("Question is required");
      return;
    }
    if (!answer.trim()) {
      toast.error("Answer is required");
      return;
    }

    setSaving(true);
    const payload = {
      question: question.trim(),
      answer: answer.trim(),
    };

    try {
      let res: Response;
      if (isEditMode && faq) {
        res = await fetch(apiUrl(`/faqs/${faq.id}`, clientId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(apiUrl("/faqs", clientId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? "Failed to save FAQ");
      }

      toast.success(
        isEditMode ? "FAQ updated successfully" : "FAQ created successfully"
      );
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save FAQ"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit FAQ" : "Add FAQ"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              Question <span className="text-destructive">*</span>
            </Label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What are your business hours?"
              className="text-sm"
            />
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              Answer <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Provide a clear and helpful answer..."
              rows={5}
              className="text-sm resize-none"
            />
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
            {isEditMode ? "Update FAQ" : "Add FAQ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
