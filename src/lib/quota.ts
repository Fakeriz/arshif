import type { Plan } from '@/data/types';

/** Limit Free vs Premium dari PRD Bab 7. null = tanpa batas. Penegakan sesungguhnya di server (Fase 2). */
export type QuotaKey = 'accounts' | 'scan' | 'automation' | 'importPdf' | 'invoice';

export const QUOTAS: Record<Plan, Record<QuotaKey, number | null>> = {
  free: { accounts: 4, scan: 20, automation: 30, importPdf: 1, invoice: 5 },
  premium: { accounts: null, scan: 300, automation: null, importPdf: 10, invoice: null },
};

export const QUOTA_LABEL: Record<QuotaKey, string> = {
  accounts: 'Akun & dompet',
  scan: 'Scan struk',
  automation: 'Automation & Voice Log',
  importPdf: 'Import PDF',
  invoice: 'Invoice',
};

export type Usage = Record<QuotaKey, number>;

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
