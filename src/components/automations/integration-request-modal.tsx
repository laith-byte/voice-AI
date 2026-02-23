"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface IntegrationRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
  } | null;
  onSuccess?: () => void;
}

export function IntegrationRequestModal({
  open,
  onOpenChange,
  recipe,
  onSuccess,
}: IntegrationRequestModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleRequest() {
    if (!recipe) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/integration-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type: "integration",
          recipe_id: recipe.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to submit request");
      }

      setSubmitted(true);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    onOpenChange(false);
    // Reset state after dialog close animation
    setTimeout(() => setSubmitted(false), 200);
  }

  if (!recipe) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="w-7 h-7 text-green-600" strokeWidth={2.5} />
            </div>
            <DialogTitle className="text-lg font-semibold mb-2">
              Request Submitted
            </DialogTitle>
            <p className="text-sm text-muted-foreground max-w-sm">
              Your administrator will reach out shortly to complete the
              integration process.
            </p>
            <Button className="mt-6 w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl">{recipe.icon ?? "⚡"}</span>
                <DialogTitle>{recipe.name}</DialogTitle>
              </div>
              {recipe.description && (
                <DialogDescription>{recipe.description}</DialogDescription>
              )}
            </DialogHeader>

            <p className="text-sm text-muted-foreground">
              This integration requires administrator setup. Click below and
              your administrator will reach out shortly to complete the process.
            </p>

            <DialogFooter>
              <Button
                className="w-full"
                onClick={handleRequest}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Request Setup
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
