"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"

interface RecipeCardProps {
  recipe: {
    id: string
    name: string
    description: string | null
    icon: string | null
    category: string
    is_coming_soon: boolean
  }
  onSetup: (recipeId: string) => void
}

export function RecipeCard({ recipe, onSetup }: RecipeCardProps) {
  return (
    <Card
      className={`relative transition-all duration-200 ${
        recipe.is_coming_soon
          ? "opacity-60"
          : "hover:shadow-md hover:border-primary/20 cursor-pointer"
      }`}
    >
      {recipe.is_coming_soon && (
        <div className="absolute top-3 right-3 z-10">
          <Badge variant="secondary" className="text-[10px] font-medium">Coming Soon</Badge>
        </div>
      )}

      <CardContent className="flex flex-col h-full p-4">
        <span className="text-2xl leading-none mb-2">
          {recipe.icon ?? "⚡"}
        </span>

        <div className="flex flex-col gap-1 flex-1">
          <h3 className="font-semibold text-sm leading-tight">
            {recipe.name}
          </h3>

          {recipe.description && (
            <p className="text-muted-foreground text-xs leading-snug line-clamp-2">
              {recipe.description}
            </p>
          )}
        </div>

        {recipe.is_coming_soon ? (
          <div className="mt-3 text-center text-xs text-muted-foreground py-1">
            We&apos;ll notify you when it&apos;s ready
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="mt-3 w-full"
            onClick={() => onSetup(recipe.id)}
          >
            Set Up
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
