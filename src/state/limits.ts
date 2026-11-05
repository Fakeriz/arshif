import { isLimited, remaining } from '@/lib/quota';

import { useStore } from './AppStore';
import { useDemoState } from './demo';

/** Fitur mana yang sudah mencapai batas Free. `?state=limit` memaksa semuanya untuk uji tampilan. */
export function useLimits() {
  const { state } = useStore();
  const forced = useDemoState() === 'limit';
  const { plan, usage } = state;
  return {
    scan: forced || isLimited(plan, 'scan', usage.scan),
    automation: forced || isLimited(plan, 'automation', usage.automation),
    importPdf: forced || isLimited(plan, 'importPdf', usage.importPdf),
    accounts: forced || isLimited(plan, 'accounts', state.accounts.length),
    scanLeft: forced ? 0 : remaining(plan, 'scan', usage.scan),
    importLeft: forced ? 0 : remaining(plan, 'importPdf', usage.importPdf),
  };
}
