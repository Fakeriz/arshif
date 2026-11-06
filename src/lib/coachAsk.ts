import { CATEGORY_KEYS, type AskContext } from '../../supabase/functions/_shared/contracts';

import type { BudgetPeriod, Pace } from './budget';
import type { Pillar } from './health';
import { currencyMeta } from './money';
import type { WeeklyRecap } from './recap';

/** Minor units -> unit besar (Rp 45.000 = 45000, RM 12,50 = 12.5), dibulatkan 2 desimal. */
export function toMajor(minor: number, currency: string): number {
  return Math.round((minor / 10 ** currencyMeta(currency).exponent) * 100) / 100;
}

export type AskSource = {
  currency: string;
  income: number;
  netWorth: number;
  period: BudgetPeriod;
  total: number;
  flexSpent: number;
  flexLimit: number;
  safePerDay: number;
  pace: Pace;
  limits: Record<'needs' | 'wants' | 'savings', number>;
  spent: Record<'needs' | 'wants' | 'savings', number>;
  byCategory: { categoryKey: string; spent: number }[];
  categoryLimits: Record<string, number>;
  week: Pick<WeeklyRecap, 'spent' | 'changePct' | 'noSpendDays'>;
  score: number | null;
  pillars: Pillar[];
};

const KNOWN = new Set<string>(CATEGORY_KEYS);

/**
 * Konteks Tanya Coach (FR-COACH-4): hanya ringkasan angka dalam mata uang utama. Tidak ada merchant, catatan,
 * nama akun, atau transaksi satu per satu yang dikirim ke AI.
 */
export function buildAskContext(s: AskSource): AskContext {
  const m = (minor: number) => toMajor(minor, s.currency);
  const keys = new Set([...s.byCategory.map((c) => c.categoryKey), ...Object.keys(s.categoryLimits)].filter((k) => KNOWN.has(k)));
  const spentOf = new Map(s.byCategory.map((c) => [c.categoryKey, c.spent]));
  const categories = [...keys]
    .map((key) => ({ key: key as AskContext['categories'][number]['key'], spent: m(spentOf.get(key) ?? 0), limit: s.categoryLimits[key] !== undefined ? m(s.categoryLimits[key]!) : null }))
    .sort((a, b) => b.spent - a.spent || a.key.localeCompare(b.key))
    .slice(0, 21);
  return {
    currency: s.currency,
    monthlyIncome: m(s.income),
    netWorth: m(s.netWorth),
    period: { elapsedPct: Math.round((s.period.elapsedDays / s.period.totalDays) * 100), daysLeft: s.period.daysLeft },
    budget: {
      total: m(s.total),
      flexSpent: m(s.flexSpent),
      flexLimit: m(s.flexLimit),
      safePerDay: m(s.safePerDay),
      pace: s.pace,
      buckets: (['needs', 'wants', 'savings'] as const).map((key) => ({ key, spent: m(s.spent[key]), limit: m(s.limits[key]) })),
    },
    categories,
    week: { spent: m(s.week.spent), changePct: s.week.changePct === null ? null : Math.max(-1000, Math.min(1000, s.week.changePct)), noSpendDays: Math.min(7, s.week.noSpendDays) },
    score: s.score,
    pillars: s.pillars.map((p) => ({ key: p.key, points: p.points, max: p.max })),
  };
}
