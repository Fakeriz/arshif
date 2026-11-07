import { initialState, type AppState } from '@/state/reducer';

import { DEMO_INCOME, DEMO_MAIN_CURRENCY, DEMO_PAYDAY, DEMO_USER, seedAccounts, seedNotifications, seedTransactions, seedUsage } from './seed';

/** State berisi data contoh. Hanya untuk test dan Lembar Desain; aplikasi memuat data dari Supabase. */
export function sampleState(): AppState {
  return {
    ...initialState(),
    status: 'ready',
    email: DEMO_USER.email,
    displayName: DEMO_USER.name,
    onboarded: true,
    accounts: seedAccounts,
    transactions: seedTransactions,
    notifications: seedNotifications,
    usage: seedUsage,
    mainCurrency: DEMO_MAIN_CURRENCY,
    income: DEMO_INCOME,
    payday: DEMO_PAYDAY,
    ratesDate: '2026-11-05',
    ratesStale: false,
  };
}
