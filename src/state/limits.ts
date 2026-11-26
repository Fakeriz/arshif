import { isLimited, remaining } from '@/lib/quota';
import type { Plan } from '@/data/types';

import { useStore } from './AppStore';

export function effectivePlan(plan: Plan, premiumUntil: string | null): Plan {
  return plan === 'premium' && premiumUntil && Date.parse(premiumUntil) <= Date.now() ? 'free' : plan;
}

/** Fitur yang sudah mencapai batas paket. Angka dari my_usage() di server; server tetap penegak akhirnya. */
export function useLimits() {
  const { state } = useStore();
  const plan = effectivePlan(state.plan, state.premiumUntil);
  const { usage } = state;
  return {
    scan: isLimited(plan, 'scan', usage.scan),
    automation: isLimited(plan, 'automation', usage.automation),
    importPdf: isLimited(plan, 'importPdf', usage.importPdf),
    invoice: isLimited(plan, 'invoice', usage.invoice),
    accounts: isLimited(plan, 'accounts', state.accounts.length),
    goals: isLimited(plan, 'goals', usage.goals),
    billsDebts: isLimited(plan, 'billsDebts', usage.billsDebts),
    subscriptions: isLimited(plan, 'subscriptions', usage.subscriptions),
    assets: isLimited(plan, 'assets', usage.assets),
    scanLeft: remaining(plan, 'scan', usage.scan),
    importLeft: remaining(plan, 'importPdf', usage.importPdf),
  };
}
