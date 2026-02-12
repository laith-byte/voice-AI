"use client";

import { cn } from "@/lib/utils";

interface TemplateCardProps {
  id: string;
  name: string;
  vertical: string;
  icon: string; // emoji
  description?: string;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function TemplateCard({
  id,
  name,
  vertical,
  icon,
  description,
  selected,
  onSelect,
}: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={cn(
        "relative w-full text-left rounded-xl border-2 p-5 transition-all duration-200 outline-none group",
        "hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5",
        "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/[0.04] shadow-md shadow-primary/10"
          : "border-gray-200 bg-white"
      )}
    >
      {/* Selected indicator dot */}
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <svg
            className="w-3 h-3 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      )}

      {/* Icon */}
      <div
        className={cn(
          "w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-3 transition-transform duration-200 group-hover:scale-110",
          selected
            ? "bg-primary/10"
            : "bg-gray-50"
        )}
      >
        {icon}
      </div>

      {/* Name */}
      <h3
        className={cn(
          "font-semibold text-[15px] mb-1 transition-colors duration-200",
          selected ? "text-primary" : "text-foreground"
        )}
      >
        {name}
      </h3>

      {/* Vertical badge */}
      <span className="inline-block text-[11px] font-medium text-muted-foreground bg-gray-100 rounded-full px-2 py-0.5 mb-2">
        {vertical}
      </span>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </button>
  );
}
