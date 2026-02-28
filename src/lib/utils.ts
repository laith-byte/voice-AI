import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Strip everything except digits and leading + for safe use in DB filters (e.g. lead phone lookup). */
export function sanitizePhone(value: string | null | undefined): string {
  if (value == null || typeof value !== "string") return "";
  return value.replace(/[^\d+]/g, "");
}
