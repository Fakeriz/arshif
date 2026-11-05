import type { Plan } from '@/data/types';

/**
 * Limit Free vs Premium dari PRD Bab 7. null = tanpa batas, 0 = fitur Premium saja.
 * Cermin plan_limits di supabase/migrations (dicek tes); penegakan sesungguhnya di server.
 * Label: `domain.quota.<key>`.
 */
export type QuotaKey =
  | 'accounts' | 'goals' | 'billsDebts' | 'subscriptions'
  | 'scan' | 'automation' | 'importPdf' | 'invoice'
  | 'coachAsk' | 'coachMonthly' | 'taxFull' | 'pdfExport';

/** month = reset tanggal 1, day = reset tiap hari, total = jumlah yang aktif, feature = Premium saja. */
export const QUOTA_WINDOW: Record<QuotaKey, 'month' | 'day' | 'total' | 'feature'> = {
  accounts: 'total', goals: 'total', billsDebts: 'total', subscriptions: 'total',
  scan: 'month', automation: 'month', importPdf: 'month', invoice: 'month',
  coachAsk: 'day', coachMonthly: 'feature', taxFull: 'feature', pdfExport: 'feature',
};

export const QUOTAS: Record<Plan, Record<QuotaKey, number | null>> = {
  free: {
    accounts: 4, goals: 3, billsDebts: 3, subscriptions: 5,
    scan: 20, automation: 30, importPdf: 1, invoice: 5,
    coachAsk: 0, coachMonthly: 0, taxFull: 0, pdfExport: 0,
  },
  premium: {
    accounts: null, goals: null, billsDebts: null, subscriptions: null,
    scan: 300, automation: null, importPdf: 10, invoice: null,
    coachAsk: 20, coachMonthly: null, taxFull: null, pdfExport: null,
  },
};

export type Usage = Record<QuotaKey, number>;

export const EMPTY_USAGE: Usage = {
  accounts: 0, goals: 0, billsDebts: 0, subscriptions: 0,
  scan: 0, automation: 0, importPdf: 0, invoice: 0,
  coachAsk: 0, coachMonthly: 0, taxFull: 0, pdfExport: 0,
};

export function isQuotaKey(key: string): key is QuotaKey {
  return key in EMPTY_USAGE;
}

export function quotaFor(plan: Plan, key: QuotaKey): number | null {
  return QUOTAS[plan][key];
}

export function isLimited(plan: Plan, key: QuotaKey, used: number): boolean {
  const limit = quotaFor(plan, key);
  return limit !== null && used >= limit;
}

export function remaining(plan: Plan, key: QuotaKey, used: number): number | null {
  const limit = quotaFor(plan, key);
  return limit === null ? null : Math.max(0, limit - used);
}

/** Fitur yang di paket Free terkunci sepenuhnya (ditandai badge PRO). */
export function isProOnly(key: QuotaKey): boolean {
  return QUOTAS.free[key] === 0;
}
