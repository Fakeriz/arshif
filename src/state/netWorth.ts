import { useEffect, useMemo } from 'react';

import { computeNetWorth, type NetWorth } from '@/lib/assets';
import { todayYmd } from '@/lib/dates';

import { useStore } from './AppStore';
import { useAssets } from './assets';
import { useLedger } from './derived';
import { usePlanning } from './planning';

export type NetWorthView = NetWorth & {
  currency: string;
  /** Utang (Planning) dan aset sudah dimuat: angka sudah lengkap. */
  complete: boolean;
};

/** Kekayaan bersih untuk Home dan tab Aset. Satu rumus: computeNetWorth (brief §3). */
export function useNetWorth(): NetWorthView {
  const { state } = useStore();
  const ledger = useLedger();
  const { debts, status: planStatus } = usePlanning();
  const { assets, prices, status } = useAssets();
  return useMemo(() => {
    const nw = computeNetWorth({ accounts: ledger.accounts, assets, prices, debts, main: ledger.mainCurrency, now: Date.now() });
    return { ...nw, currency: ledger.mainCurrency, complete: planStatus === 'ready' && status === 'ready' };
    // ratesVersion: kurs berubah = konversi berubah (sama dengan useLedger).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger, assets, prices, debts, planStatus, status, state.ratesVersion]);
}

/**
 * Snapshot harian untuk grafik riwayat (brief §7): disimpan saat aplikasi dibuka, hanya bila angkanya lengkap
 * dan semua kurs tersedia. Snapshot hari ini ditimpa bila angkanya berubah.
 */
export function useNetWorthSnapshot(nw: NetWorthView) {
  const { state } = useStore();
  const { recordSnapshot } = useAssets();
  const ready = state.status === 'ready' && nw.complete && nw.unconverted === 0;
  useEffect(() => {
    if (!ready) return;
    recordSnapshot({ date: todayYmd(), total: nw.total, assetsTotal: nw.assetsTotal, liabilitiesTotal: nw.liabilitiesTotal, currency: nw.currency });
  }, [ready, nw.total, nw.assetsTotal, nw.liabilitiesTotal, nw.currency, recordSnapshot]);
}
