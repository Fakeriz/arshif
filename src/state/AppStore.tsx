import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';

import { accountBalance } from '@/lib/transactions';
import type { Account } from '@/data/types';

import { initialState, reducer, type Action, type AppState } from './reducer';

type StoreValue = { state: AppState; dispatch: Dispatch<Action> };

const StoreContext = createContext<StoreValue | null>(null);

/** Store memori Fase 1. Fase 2: diganti query Supabase + cache, bentuk hook tetap sama. */
export function AppStoreProvider({ children, preset }: { children: ReactNode; preset?: Partial<AppState> }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...initialState(), ...preset }));
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore harus dipakai di dalam <AppStoreProvider>');
  return ctx;
}

export type AccountWithBalance = Account & { balance: number };

export function useAccounts(): AccountWithBalance[] {
  const { state } = useStore();
  return useMemo(
    () => state.accounts.map((a) => ({ ...a, balance: accountBalance(a, state.transactions) })),
    [state.accounts, state.transactions],
  );
}

/** Akun default untuk pencatatan: kartu aktif di Beranda, atau akun pertama. */
export function useActiveAccountId(): string | null {
  const { state } = useStore();
  const active = state.accounts.find((a) => a.id === state.activeAccountId);
  return (active ?? state.accounts[0])?.id ?? null;
}
