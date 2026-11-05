import { isLimited, remaining } from '@/lib/quota';

import { useStore } from './AppStore';

/** Fitur yang sudah mencapai batas paket. Angka dari my_usage() di server; server tetap penegak akhirnya. */
export function useLimits() {
  const { state } = useStore();
  const { plan, usage } = state;
  return {
    scan: isLimited(plan, 'scan', usage.scan),
    automation: isLimited(plan, 'automation', usage.automation),
    importPdf: isLimited(plan, 'importPdf', usage.importPdf),
    accounts: isLimited(plan, 'accounts', state.accounts.length),
    goals: isLimited(plan, 'goals', usage.goals),
    billsDebts: isLimited(plan, 'billsDebts', usage.billsDebts),
    subscriptions: isLimited(plan, 'subscriptions', usage.subscriptions),
    scanLeft: remaining(plan, 'scan', usage.scan),
    importLeft: remaining(plan, 'importPdf', usage.importPdf),
  };
}
