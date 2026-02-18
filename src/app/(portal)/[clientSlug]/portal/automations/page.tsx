"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { RecipeCard } from "@/components/automations/recipe-card";
import { RecipeSetupModal } from "@/components/automations/recipe-setup-modal";
import { ActiveAutomationCard } from "@/components/automations/active-automation-card";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { UpgradeBanner } from "@/components/portal/upgrade-banner";
import { ZapierConnectionCard } from "@/components/portal/zapier-connection-card";
import { Lock } from "lucide-react";

interface Recipe {
  id: string;
  name: string;
  description: string | null;
  long_description: string | null;
  icon: string | null;
  category: string;
  config_schema: FieldDef[];
  what_gets_sent: string[] | null;
  is_active: boolean;
  is_coming_soon: boolean;
}

interface FieldDef {
  key: string;
  label: string;
  type:
    | "text"
    | "url"
    | "email"
    | "select"
    | "multi_select"
    | "toggle"
    | "number"
    | "oauth_connect"
    | "resource_picker"
    | "webhook_config";
  required?: boolean;
  placeholder?: string;
  default?: string | number | boolean;
  options?: string[];
  help_text?: string;
  provider?: string;
  picker_type?: string;
  depends_on?: string;
}

interface Automation {
  id: string;
  recipe_id: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  last_triggered_at: string | null;
  trigger_count: number;
  error_count: number;
  last_error: string | null;
  automation_recipes: Recipe;
}

interface OAuthConnection {
  provider: string;
  provider_email: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  slack: "Slack",
  hubspot: "HubSpot",
  quickbooks: "QuickBooks",
};

// Map recipe categories/names to plan access fields
const RECIPE_PLAN_GATES: Record<string, string> = {
  sms_notification: "sms_notification",
  sms: "sms_notification",
  caller_followup_email: "caller_followup_email",
  email: "caller_followup_email",
  google_calendar: "google_calendar",
  calendar: "google_calendar",
  slack: "slack_integration",
  slack_notification: "slack_integration",
  crm: "crm_integration",
  hubspot: "crm_integration",
  webhook: "webhook_forwarding",
  webhook_forwarding: "webhook_forwarding",
};

function isRecipeGated(recipeName: string, recipeCategory: string, planAccess: Record<string, unknown> | null): boolean {
  if (!planAccess) return false; // No plan info = allow
  const nameKey = recipeName.toLowerCase().replace(/\s+/g, "_");
  const catKey = recipeCategory.toLowerCase().replace(/\s+/g, "_");

  // Check name-based gate
  for (const [pattern, field] of Object.entries(RECIPE_PLAN_GATES)) {
    if (nameKey.includes(pattern) || catKey.includes(pattern)) {
      return planAccess[field] === false;
    }
  }
  return false;
}

export default function PortalAutomationsPage() {
  const searchParams = useSearchParams();
  const { planAccess } = usePlanAccess();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [oauthConnections, setOauthConnections] = useState<OAuthConnection[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [setupRecipe, setSetupRecipe] = useState<Recipe | null>(null);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [recipesRes, automationsRes, connectionsRes] = await Promise.all([
        fetch("/api/automations/recipes"),
        fetch("/api/automations/client"),
        fetch("/api/oauth/connections"),
      ]);

      if (recipesRes.ok) {
        const data = await recipesRes.json();
        setRecipes(data.recipes || []);
      }
      if (automationsRes.ok) {
        const data = await automationsRes.json();
        setAutomations(data.automations || []);
        // Extract clientId from first automation or from a dedicated endpoint
        if (data.client_id) setClientId(data.client_id);
      }
      if (connectionsRes.ok) {
        const data = await connectionsRes.json();
        setOauthConnections(data.connections || []);
      }
    } catch {
      toast.error("Failed to load automations");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/oauth/connections");
      if (res.ok) {
        const data = await res.json();
        setOauthConnections(data.connections || []);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle ?connected= and ?oauth_error= query params
  useEffect(() => {
    const connected = searchParams.get("connected");
    const oauthError = searchParams.get("oauth_error");

    if (connected) {
      const label = PROVIDER_LABELS[connected] || connected;
      toast.success(`${label} connected successfully!`);
      fetchConnections();
      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.pathname);
    }

    if (oauthError) {
      toast.error(`OAuth connection failed: ${oauthError}`);
      const url = new URL(window.location.href);
      url.searchParams.delete("oauth_error");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [searchParams, fetchConnections]);

  // Filter recipes: show only active ones that the client hasn't enabled yet
  const enabledRecipeIds = new Set(automations.map((a) => a.recipe_id));
  const allAvailableRecipes = recipes.filter(
    (r) => r.is_active && !enabledRecipeIds.has(r.id)
  );
  // Split available into unlocked and gated
  const availableRecipes = allAvailableRecipes.filter(
    (r) => !isRecipeGated(r.name, r.category, planAccess as Record<string, unknown> | null)
  );
  const gatedRecipes = allAvailableRecipes.filter(
    (r) => isRecipeGated(r.name, r.category, planAccess as Record<string, unknown> | null)
  );
  const comingSoonRecipes = recipes.filter((r) => r.is_coming_soon);

  // Check max_recipes limit
  const maxRecipes = planAccess?.max_recipes;
  const atRecipeLimit = maxRecipes !== null && maxRecipes !== undefined && automations.length >= maxRecipes;
  const activeAutomations = automations.filter((a) => a.is_enabled);
  const disabledAutomations = automations.filter((a) => !a.is_enabled);

  async function handleSetup(recipeId: string, config: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/automations/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_id: recipeId, config }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to enable automation");
      }

      toast.success("Automation enabled!");
      setSetupRecipe(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enable");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(recipeId: string, config: Record<string, unknown>) {
    if (!editingAutomation) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/automations/client/${editingAutomation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });

      if (!res.ok) throw new Error("Failed to update");

      toast.success("Automation updated!");
      setEditingAutomation(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(automationId: string, enabled: boolean) {
    // Optimistic update
    setAutomations((prev) =>
      prev.map((a) =>
        a.id === automationId ? { ...a, is_enabled: enabled } : a
      )
    );

    try {
      const res = await fetch(`/api/automations/client/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled: enabled }),
      });

      if (!res.ok) throw new Error("Failed to toggle");
      toast.success(enabled ? "Automation enabled" : "Automation disabled", { duration: 2000 });
    } catch {
      // Revert
      setAutomations((prev) =>
        prev.map((a) =>
          a.id === automationId ? { ...a, is_enabled: !enabled } : a
        )
      );
      toast.error("Failed to update automation");
    }
  }

  function handleEdit(automationId: string) {
    const automation = automations.find((a) => a.id === automationId);
    if (automation) {
      setEditingAutomation(automation);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Automations</h1>
              <p className="text-sm text-muted-foreground">
                Supercharge your AI agent with one-click integrations.
              </p>
            </div>
          </div>
        </div>

        {/* Active Automations */}
        {activeAutomations.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-green-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Active ({activeAutomations.length})
              </h2>
            </div>
            <div className="space-y-3">
              {activeAutomations.map((automation) => (
                <ActiveAutomationCard
                  key={automation.id}
                  automation={automation}
                  onEdit={handleEdit}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </section>
        )}

        {/* Disabled Automations */}
        {disabledAutomations.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Disabled ({disabledAutomations.length})
            </h2>
            <div className="space-y-3">
              {disabledAutomations.map((automation) => (
                <ActiveAutomationCard
                  key={automation.id}
                  automation={automation}
                  onEdit={handleEdit}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </section>
        )}

        {/* Recipe Limit Warning */}
        {atRecipeLimit && (
          <UpgradeBanner
            feature="Recipe Limit Reached"
            plan="Professional"
            description={`Your plan allows up to ${maxRecipes} active automations. Upgrade for unlimited recipes.`}
          />
        )}

        {/* Available Recipes Gallery */}
        {availableRecipes.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Available Recipes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
              {availableRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onSetup={() => atRecipeLimit ? undefined : setSetupRecipe(recipe)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Gated Recipes (locked by plan) */}
        {gatedRecipes.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              <Lock className="w-3.5 h-3.5 inline mr-1.5" />
              Upgrade to Unlock
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
              {gatedRecipes.map((recipe) => (
                <div key={recipe.id} className="relative opacity-60">
                  <RecipeCard
                    recipe={recipe}
                    onSetup={() => {}}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/40 rounded-xl">
                    <Lock className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Coming Soon */}
        {comingSoonRecipes.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Coming Soon
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
              {comingSoonRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onSetup={() => {}}
                />
              ))}
            </div>
          </section>
        )}

        {/* Integrations */}
        {clientId && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Integrations
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ZapierConnectionCard clientId={clientId} />
            </div>
          </section>
        )}

        {/* Empty state */}
        {recipes.length === 0 && automations.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 mb-4">
              <Sparkles className="w-8 h-8 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No automations available yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Automation recipes will appear here once your administrator sets them up. Check back soon!
            </p>
          </div>
        )}
      </div>

      {/* Setup Modal */}
      <RecipeSetupModal
        open={!!setupRecipe}
        onOpenChange={(open) => !open && setSetupRecipe(null)}
        recipe={setupRecipe}
        saving={saving}
        onSave={handleSetup}
        clientId={clientId}
        oauthConnections={oauthConnections}
        onConnectionChange={fetchConnections}
      />

      {/* Edit Modal */}
      <RecipeSetupModal
        open={!!editingAutomation}
        onOpenChange={(open) => !open && setEditingAutomation(null)}
        recipe={editingAutomation?.automation_recipes ?? null}
        existingConfig={editingAutomation?.config}
        saving={saving}
        onSave={handleEditSave}
        clientId={clientId}
        oauthConnections={oauthConnections}
        onConnectionChange={fetchConnections}
      />
    </div>
  );
}
