"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Plus, Trash2 } from "lucide-react"

type FieldDef = {
  key: string
  label: string
  type: string
  required?: boolean
  placeholder?: string
  default?: string | number | boolean
  options?: string[]
}

interface RecipeEditorProps {
  recipe?: {
    id: string
    name: string
    description: string | null
    long_description: string | null
    icon: string | null
    category: string
    n8n_webhook_url: string
    n8n_workflow_id: string | null
    config_schema: FieldDef[]
    what_gets_sent: string[] | null
    is_active: boolean
    is_coming_soon: boolean
    sort_order: number
  } | null
  saving: boolean
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
}

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "leads", label: "Leads" },
  { value: "notifications", label: "Notifications" },
  { value: "scheduling", label: "Scheduling" },
  { value: "integrations", label: "Integrations" },
]

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "select", label: "Select" },
  { value: "multi_select", label: "Multi Select" },
  { value: "toggle", label: "Toggle" },
  { value: "number", label: "Number" },
]

function emptyField(): FieldDef {
  return {
    key: "",
    label: "",
    type: "text",
    required: false,
    placeholder: "",
    default: "",
    options: [],
  }
}

export function RecipeEditor({
  recipe,
  saving,
  onSave,
  onCancel,
}: RecipeEditorProps) {
  const [name, setName] = useState(recipe?.name ?? "")
  const [description, setDescription] = useState(recipe?.description ?? "")
  const [longDescription, setLongDescription] = useState(
    recipe?.long_description ?? ""
  )
  const [icon, setIcon] = useState(recipe?.icon ?? "")
  const [category, setCategory] = useState(recipe?.category ?? "general")
  const [webhookUrl, setWebhookUrl] = useState(recipe?.n8n_webhook_url ?? "")
  const [workflowId, setWorkflowId] = useState(recipe?.n8n_workflow_id ?? "")
  const [isActive, setIsActive] = useState(recipe?.is_active ?? true)
  const [isComingSoon, setIsComingSoon] = useState(
    recipe?.is_coming_soon ?? false
  )
  const [sortOrder, setSortOrder] = useState(recipe?.sort_order ?? 0)
  const [configSchema, setConfigSchema] = useState<FieldDef[]>(
    recipe?.config_schema ?? []
  )
  const [whatGetsSent, setWhatGetsSent] = useState<string[]>(
    recipe?.what_gets_sent ?? []
  )

  // --- Config Schema helpers ---

  function updateField(index: number, patch: Partial<FieldDef>) {
    setConfigSchema((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    )
  }

  function removeField(index: number) {
    setConfigSchema((prev) => prev.filter((_, i) => i !== index))
  }

  function addField() {
    setConfigSchema((prev) => [...prev, emptyField()])
  }

  // --- What Gets Sent helpers ---

  function updateSentItem(index: number, value: string) {
    setWhatGetsSent((prev) => prev.map((s, i) => (i === index ? value : s)))
  }

  function removeSentItem(index: number) {
    setWhatGetsSent((prev) => prev.filter((_, i) => i !== index))
  }

  function addSentItem() {
    setWhatGetsSent((prev) => [...prev, ""])
  }

  // --- Submit ---

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      name,
      description: description || null,
      long_description: longDescription || null,
      icon: icon || null,
      category,
      n8n_webhook_url: webhookUrl,
      n8n_workflow_id: workflowId || null,
      config_schema: configSchema,
      what_gets_sent: whatGetsSent.length > 0 ? whatGetsSent : null,
      is_active: isActive,
      is_coming_soon: isComingSoon,
      sort_order: sortOrder,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ── Basic Info ──────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Basic Info
        </h3>
        <div className="h-px bg-border" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="recipe-name">Name</Label>
            <Input
              id="recipe-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New Lead Notifier"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipe-icon">Icon</Label>
            <Input
              id="recipe-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="e.g. 🔔"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipe-description">Description</Label>
          <Input
            id="recipe-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short one-liner shown on the card"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipe-long-description">Long Description</Label>
          <Textarea
            id="recipe-long-description"
            value={longDescription}
            onChange={(e) => setLongDescription(e.target.value)}
            placeholder="Detailed description shown on the setup page"
            rows={3}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="recipe-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="recipe-category" className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipe-sort-order">Sort Order</Label>
            <Input
              id="recipe-sort-order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              min={0}
            />
          </div>
        </div>
      </section>

      {/* ── n8n Configuration ──────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          n8n Configuration
        </h3>
        <div className="h-px bg-border" />

        <div className="space-y-2">
          <Label htmlFor="recipe-webhook-url">n8n Webhook URL</Label>
          <Input
            id="recipe-webhook-url"
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://n8n.example.com/webhook/..."
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipe-workflow-id">
            n8n Workflow ID{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="recipe-workflow-id"
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            placeholder="e.g. 42"
          />
        </div>
      </section>

      {/* ── Status ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Status
        </h3>
        <div className="h-px bg-border" />

        <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
          <div className="flex items-center gap-3">
            <Switch
              id="recipe-is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="recipe-is-active">Is Active</Label>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="recipe-is-coming-soon"
              checked={isComingSoon}
              onCheckedChange={setIsComingSoon}
            />
            <Label htmlFor="recipe-is-coming-soon">Is Coming Soon</Label>
          </div>
        </div>
      </section>

      {/* ── Config Schema Builder ──────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Config Schema
        </h3>
        <div className="h-px bg-border" />

        {configSchema.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No fields defined yet. Add fields to build the configuration form
            that clients will fill out.
          </p>
        )}

        <div className="space-y-4">
          {configSchema.map((field, index) => (
            <div
              key={index}
              className="relative rounded-lg border bg-muted/30 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Field {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeField(index)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Key</Label>
                  <Input
                    value={field.key}
                    onChange={(e) =>
                      updateField(index, { key: e.target.value })
                    }
                    placeholder="e.g. slack_channel"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={field.label}
                    onChange={(e) =>
                      updateField(index, { label: e.target.value })
                    }
                    placeholder="e.g. Slack Channel"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={field.type}
                    onValueChange={(value) =>
                      updateField(index, { type: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Placeholder</Label>
                  <Input
                    value={field.placeholder ?? ""}
                    onChange={(e) =>
                      updateField(index, { placeholder: e.target.value })
                    }
                    placeholder="e.g. #general"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Default</Label>
                  <Input
                    value={String(field.default ?? "")}
                    onChange={(e) =>
                      updateField(index, { default: e.target.value })
                    }
                    placeholder="Default value"
                  />
                </div>

                <div className="flex items-end pb-1.5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`field-required-${index}`}
                      checked={field.required ?? false}
                      onCheckedChange={(checked) =>
                        updateField(index, { required: checked === true })
                      }
                    />
                    <Label
                      htmlFor={`field-required-${index}`}
                      className="text-xs"
                    >
                      Required
                    </Label>
                  </div>
                </div>
              </div>

              {(field.type === "select" || field.type === "multi_select") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Options{" "}
                    <span className="text-muted-foreground font-normal">
                      (comma-separated)
                    </span>
                  </Label>
                  <Input
                    value={(field.options ?? []).join(", ")}
                    onChange={(e) =>
                      updateField(index, {
                        options: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="e.g. option1, option2, option3"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addField}
        >
          <Plus className="size-3.5" />
          Add Field
        </Button>
      </section>

      {/* ── What Gets Sent ─────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          What Gets Sent
        </h3>
        <div className="h-px bg-border" />

        {whatGetsSent.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No items yet. Describe the data that will be sent to n8n when this
            recipe fires.
          </p>
        )}

        <div className="space-y-2">
          {whatGetsSent.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={item}
                onChange={(e) => updateSentItem(index, e.target.value)}
                placeholder="e.g. Lead name, email, and source"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => removeSentItem(index)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSentItem}
        >
          <Plus className="size-3.5" />
          Add Item
        </Button>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <div className="h-px bg-border" />
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {recipe ? "Save Changes" : "Create Recipe"}
        </Button>
      </div>
    </form>
  )
}
