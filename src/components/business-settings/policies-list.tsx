"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  PolicyEditorModal,
  type PolicyData,
} from "./policy-editor-modal";

interface PoliciesListProps {
  clientId?: string;
}

function apiUrl(path: string, clientId?: string) {
  const base = `/api/business-settings${path}`;
  return clientId ? `${base}?client_id=${clientId}` : base;
}

export function PoliciesList({ clientId }: PoliciesListProps) {
  const [policies, setPolicies] = useState<PolicyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyData | null>(null);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/policies", clientId));
      if (!res.ok) throw new Error("Failed to fetch policies");
      const data = await res.json();
      setPolicies(data.policies ?? data ?? []);
    } catch {
      toast.error("Failed to load policies");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this policy?")) return;
    try {
      const res = await fetch(apiUrl(`/policies/${id}`, clientId), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete policy");
      toast.success("Policy deleted");
      fetchPolicies();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete policy"
      );
    }
  }

  function handleEdit(policy: PolicyData) {
    setEditingPolicy(policy);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditingPolicy(null);
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
              <div className="h-7 w-7 rounded-md bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Policies</h3>
                <p className="text-[11px] text-muted-foreground">
                  Business policies your AI agent can communicate to callers
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleAdd} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Policy
            </Button>
          </div>
        </div>
        <CardContent className="p-4">
          {policies.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No policies added yet. Add your business policies so the AI
                agent can reference them.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className="border rounded-lg p-4 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{policy.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {policy.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(policy)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(policy.id)}
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

      <PolicyEditorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        policy={editingPolicy}
        clientId={clientId}
        onSaved={fetchPolicies}
      />
    </>
  );
}
