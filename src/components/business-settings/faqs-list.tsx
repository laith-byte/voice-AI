"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FaqEditorModal, type FaqData } from "./faq-editor-modal";

interface FaqsListProps {
  clientId?: string;
}

function apiUrl(path: string, clientId?: string) {
  const base = `/api/business-settings${path}`;
  return clientId ? `${base}?client_id=${clientId}` : base;
}

export function FaqsList({ clientId }: FaqsListProps) {
  const [faqs, setFaqs] = useState<FaqData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FaqData | null>(null);

  const fetchFaqs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/faqs", clientId));
      if (!res.ok) throw new Error("Failed to fetch FAQs");
      const data = await res.json();
      setFaqs(data.faqs ?? data ?? []);
    } catch {
      toast.error("Failed to load FAQs");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this FAQ?")) return;
    try {
      const res = await fetch(apiUrl(`/faqs/${id}`, clientId), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete FAQ");
      toast.success("FAQ deleted");
      fetchFaqs();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete FAQ"
      );
    }
  }

  function handleEdit(faq: FaqData) {
    setEditingFaq(faq);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditingFaq(null);
    setModalOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card className="overflow-hidden animate-fade-in-up glass-card">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                <HelpCircle className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">FAQs</h3>
                <p className="text-[11px] text-muted-foreground">
                  Frequently asked questions your AI agent can reference
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleAdd} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add FAQ
            </Button>
          </div>
        </div>
        <CardContent className="p-4">
          {faqs.length === 0 ? (
            <div className="text-center py-8">
              <HelpCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No FAQs added yet. Add common questions and answers to help your
                AI agent.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {faqs.map((faq) => (
                <div
                  key={faq.id}
                  className="border rounded-lg p-4 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{faq.question}</p>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {faq.answer}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(faq)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(faq.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FaqEditorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        faq={editingFaq}
        clientId={clientId}
        onSaved={fetchFaqs}
      />
    </>
  );
}
