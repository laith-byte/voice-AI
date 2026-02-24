"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Pencil, AlertCircle, Clock, Zap } from "lucide-react"

interface ActiveAutomationCardProps {
  automation: {
    id: string
    is_enabled: boolean
    config: Record<string, unknown>
    last_triggered_at: string | null
    trigger_count: number
    error_count: number
    last_error: string | null
    automation_recipes: {
      id: string
      name: string
      description: string | null
      icon: string | null
    }
  }
  onEdit: (automationId: string) => void
  onToggle: (automationId: string, enabled: boolean) => void
}

function timeAgo(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return "just now"

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`

  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? "" : "s"} ago`
}

export function ActiveAutomationCard({
  automation,
  onEdit,
  onToggle,
}: ActiveAutomationCardProps) {
  const { automation_recipes: recipe } = automation
  const hasError = automation.error_count > 0 || automation.last_error

  return (
    <Card
      className={`border-l-4 transition-all duration-200 hover:shadow-md ${
        automation.is_enabled
          ? "border-l-green-500"
          : "border-l-gray-300"
      }`}
    >
      <CardContent className="flex flex-col gap-3 p-5">
        {/* Header row: icon + name on left, switch on right */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl leading-none shrink-0">
              {recipe.icon ?? "⚡"}
            </span>
            <h3 className="font-semibold text-sm leading-tight truncate">
              {recipe.name}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={automation.is_enabled ? "default" : "secondary"}
              className="text-xs"
            >
              {automation.is_enabled ? "Enabled" : "Disabled"}
            </Badge>
            <Switch
              checked={automation.is_enabled}
              onCheckedChange={(checked) =>
                onToggle(automation.id, checked)
              }
            />
          </div>
        </div>

        {/* Description */}
        {recipe.description && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {recipe.description}
          </p>
        )}

        {/* Error banner */}
        {hasError && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2">
            <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-medium text-destructive">
                {automation.error_count} error
                {automation.error_count === 1 ? "" : "s"}
              </span>
              {automation.last_error && (
                <span className="text-xs text-destructive/80 line-clamp-2">
                  {automation.last_error}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Footer row: stats on left, edit button on right */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-4 text-muted-foreground">
            {automation.last_triggered_at && (
              <span className="flex items-center gap-1 text-xs">
                <Clock className="size-3.5" />
                Last triggered {timeAgo(automation.last_triggered_at)}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs">
              <Zap className="size-3.5" />
              {automation.trigger_count} trigger
              {automation.trigger_count === 1 ? "" : "s"}
            </span>
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={() => onEdit(automation.id)}
          >
            <Pencil />
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
