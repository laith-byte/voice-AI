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

/**
 * Normalize phone for consistent lead storage and matching.
 * Sanitizes then, if 10 digits (US/Canada without country code), prepends +1.
 * Use when inserting/updating leads so lookup and storage formats align.
 */
export function normalizeLeadPhone(phone: string | null | undefined): string {
  const sanitized = sanitizePhone(phone);
  if (!sanitized) return "";
  // US/Canada: 10 digits without country code → store with +1
  if (/^\d{10}$/.test(sanitized)) return `+1${sanitized}`;
  return sanitized;
}
