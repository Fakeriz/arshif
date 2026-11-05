import type { Goal } from '@/data/planning';

import { monthsUntil } from './schedule';

export const goalProgress = (g: Pick<Goal, 'collected' | 'target'>): number => (g.target > 0 ? Math.min(1, g.collected / g.target) : 0);

/** Saran setoran per bulan = (target - terkumpul) / sisa bulan, dibulatkan ke atas. null = tanpa tenggat atau sudah tercapai. */
export function suggestedMonthly(g: Pick<Goal, 'collected' | 'target' | 'deadline'>, today: string): number | null {
  const left = g.target - g.collected;
  if (!g.deadline || left <= 0) return null;
  const months = monthsUntil(today, g.deadline);
  return Math.ceil(left / months);
}
