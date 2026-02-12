"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Loader2,
  Sparkles,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { RecipeEditor } from "@/components/automations/recipe-editor";

interface Recipe {
  id: string;
  name: string;
  description: string | null;
  long_description: string | null;
  icon: string | null;
  category: string;
  n8n_webhook_url: string;
  n8n_workflow_id: string | null;
  config_schema: FieldDef[];
  what_gets_sent: string[] | null;
  is_active: boolean;
  is_coming_soon: boolean;
  sort_order: number;
}

interface FieldDef {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  default?: string | number | boolean;
  options?: string[];
}

interface ClientAutomationSummary {
  recipe_id: string;
  client_count: number;
  last_triggered_at: string | null;
}

export default function StartupAutomationsPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [clientStats, setClientStats] = useState<Record<string, ClientAutomationSummary>>({});
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch recipes via API
      const res = await fetch("/api/automations/recipes");
      if (res.ok) {
        const data = await res.json();
        setRecipes(data.recipes || []);
      }

      // Fetch client automation stats directly from Supabase
      const supabase = createClient();
      const { data: automations } = await supabase
        .from("client_automations")
        .select("recipe_id, client_id, last_triggered_at, is_enabled");

      if (automations) {
        const statsMap: Record<string, ClientAutomationSummary> = {};
        for (const a of automations) {
          if (!a.is_enabled) continue;
          if (!statsMap[a.recipe_id]) {
            statsMap[a.recipe_id] = {
              recipe_id: a.recipe_id,
              client_count: 0,
              last_triggered_at: null,
            };
          }
          statsMap[a.recipe_id].client_count++;
          if (
            a.last_triggered_at &&
            (!statsMap[a.recipe_id].last_triggered_at ||
              a.last_triggered_at > statsMap[a.recipe_id].last_triggered_at!)
          ) {
            statsMap[a.recipe_id].last_triggered_at = a.last_triggered_at;
          }
        }
        setClientStats(statsMap);
      }
    } catch {
      toast.error("Failed to load recipes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSaveRecipe(data: Record<string, unknown>) {
    setSaving(true);
    try {
      const url = editingRecipe
        ? `/api/automations/recipes/${editingRecipe.id}`
        : "/api/automations/recipes";
      const method = editingRecipe ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to save recipe");
      }

      toast.success(editingRecipe ? "Recipe updated" : "Recipe created");
      setEditorOpen(false);
      setEditingRecipe(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRecipe(id: string) {
    try {
      const res = await fetch(`/api/automations/recipes/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Recipe deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete recipe");
    }
  }

  async function handleToggleActive(recipe: Recipe) {
    try {
      const res = await fetch(`/api/automations/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !recipe.is_active }),
      });

      if (!res.ok) throw new Error("Failed to toggle");

      setRecipes((prev) =>
        prev.map((r) =>
          r.id === recipe.id ? { ...r, is_active: !r.is_active } : r
        )
      );
    } catch {
      toast.error("Failed to toggle recipe status");
    }
  }

  function handleEditRecipe(recipe: Recipe) {
    setEditingRecipe(recipe);
    setEditorOpen(true);
  }

  function handleCreateRecipe() {
    setEditingRecipe(null);
    setEditorOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#111827]">Automations</h1>
            <p className="text-sm text-[#6b7280] mt-0.5">
              Manage automation recipes and monitor client integrations.
            </p>
          </div>
        </div>
        <Button
          className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
          onClick={handleCreateRecipe}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Recipe
        </Button>
      </div>

      {/* Recipes Table */}
      {recipes.length > 0 ? (
        <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-gray-50">
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Recipe
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  n8n Webhook
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Clients
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Last Triggered
                </th>
                <th className="text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-right text-xs font-medium text-[#6b7280] uppercase tracking-wider px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {recipes.map((recipe) => {
                const stats = clientStats[recipe.id];
                return (
                  <tr key={recipe.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{recipe.icon || "⚡"}</span>
                        <div>
                          <span className="text-sm font-medium text-[#111827]">
                            {recipe.name}
                          </span>
                          {recipe.description && (
                            <p className="text-xs text-[#6b7280] mt-0.5 line-clamp-1">
                              {recipe.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded text-[#6b7280] font-mono max-w-[200px] truncate block">
                        {recipe.n8n_webhook_url}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#6b7280]" />
                        <span className="text-sm text-[#6b7280]">
                          {stats?.client_count || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#6b7280]">
                        {stats?.last_triggered_at
                          ? timeAgo(stats.last_triggered_at)
                          : "Never"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {recipe.is_coming_soon ? (
                        <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                      ) : (
                        <Switch
                          checked={recipe.is_active}
                          onCheckedChange={() => handleToggleActive(recipe)}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditRecipe(recipe)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {recipe.n8n_webhook_url && (
                            <DropdownMenuItem asChild>
                              <a
                                href={recipe.n8n_webhook_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Open Webhook
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDeleteRecipe(recipe.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-[#e5e7eb] border-dashed rounded-lg py-16 flex flex-col items-center justify-center">
          <div className="bg-violet-100 rounded-full p-3 mb-4">
            <Sparkles className="h-6 w-6 text-violet-600" />
          </div>
          <h3 className="text-sm font-medium text-[#111827] mb-1">
            No automation recipes yet
          </h3>
          <p className="text-sm text-[#6b7280] mb-4">
            Create your first recipe to enable one-click integrations for your clients.
          </p>
          <Button
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
            onClick={handleCreateRecipe}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Recipe
          </Button>
        </div>
      )}

      {/* Recipe Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecipe ? "Edit Recipe" : "Create Recipe"}
            </DialogTitle>
          </DialogHeader>
          <RecipeEditor
            recipe={editingRecipe}
            saving={saving}
            onSave={handleSaveRecipe}
            onCancel={() => {
              setEditorOpen(false);
              setEditingRecipe(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function timeAgo(date: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
