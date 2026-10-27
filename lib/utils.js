import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"
import { HAPTIC_PATTERNS, useHaptic } from "@/hooks/useHaptic";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export { HAPTIC_PATTERNS, useHaptic };

export const triggerHaptic = (type = 'light') => {
  if (typeof window === 'undefined') return
  try {
    const pattern =
      typeof type === 'string'
        ? (HAPTIC_PATTERNS?.[type] ?? 10)
        : (type ?? 10)
    window?.navigator?.vibrate?.(pattern)
  } catch (e) {
    // Safe fallback jika permission ditolak / tidak didukung
  }
}

