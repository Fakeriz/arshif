import { useMemo } from 'react';

import { addDays, todayYmd } from '@/lib/dates';
import { missingRates, tryConvert } from '@/lib/fx';
import { valueAsset } from '@/lib/assets';
import {
  averageBudget, budgetFor, bucketLimits, budgetPeriod, pace, previousBudgets, safeToSpend, spendByBucket, spendByCategory,
} from '@/lib/budget';
import { cardUtilization } from '@/lib/credit';
import { healthPillars, healthScore } from '@/lib/health';
import { occurrencesInMonth } from '@/lib/planning/schedule';
import { accountBalance } from '@/lib/transactions';

import type { Transaction } from '@/data/types';

import { usedCodes, useStore, type AccountWithBalance } from './AppStore';
import { useAssetsOptional } from './assets';
import { usePlanningOptional } from './planning';

type Ledger = { accounts: AccountWithBalance[]; transactions: Transaction[]; mainCurrency: string };
// Satu hitungan dibagi semua pemanggil: Beranda memanggil useLedger 3x dan Coach 4x+, masing-masing
// dulu menghitung ulang saldo semua akun dari semua transaksi. Kunci = identitas bagian state yang dipakai.
let ledgerCache: { key: unknown[]; value: Ledger } | null = null;

/** Akun (dengan saldo) + transaksi. Kekayaan bersih: useNetWorth (state/netWorth), satu rumus untuk semua layar. */
export function useLedger(): Ledger {
  const { state } = useStore();
  // ratesDate/ratesVersion/userRates: kurs berubah = konversi ke mata uang utama ikut berubah.
  const key = [state.accounts, state.transactions, state.mainCurrency, state.ratesDate, state.ratesVersion, state.userRates];
  if (!ledgerCache || key.some((k, i) => k !== ledgerCache!.key[i])) {
    const accounts = state.accounts.map((a) => ({ ...a, balance: accountBalance(a, state.transactions) }));
    ledgerCache = { key, value: { accounts, transactions: state.transactions, mainCurrency: state.mainCurrency } };
  }
  return ledgerCache.value;
}

/** Kode mata uang yang dipakai tapi belum punya kurs harian maupun "Kurs saya" (FR-FX-4). */
export function useMissingRates(): string[] {
  const { state } = useStore();
  const assetsCtx = useAssetsOptional();
  const planningCtx = usePlanningOptional();
  return useMemo(() => {
    const extra = state.limitGroups.map((g) => g.currency);
    const prices = assetsCtx?.prices ?? {};
    for (const a of assetsCtx?.assets ?? []) {
      if (a.valueOverride !== undefined || (a.buyPrice !== undefined && a.buyPrice > 0)) extra.push(a.currency);
      const v = valueAsset(a, prices, 0);
      if (v.value !== null) extra.push(v.currency);
    }
    for (const d of planningCtx?.debts ?? []) {
      if (d.status === 'active') extra.push(d.currency);
    }
    return missingRates(usedCodes(state.accounts, state.transactions, state.mainCurrency, extra));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.accounts,
    state.transactions,
    state.mainCurrency,
    state.limitGroups,
    state.ratesDate,
    state.ratesVersion,
    state.userRates,
    assetsCtx?.assets,
    assetsCtx?.prices,
    planningCtx?.debts,
  ]);
}

/** Utilisasi limit per kartu (grup gabungan bila ada, FR-ACC-6). */
export function useCreditUtilization() {
  const { state } = useStore();
  const { accounts } = useLedger();
  return useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, cardUtilization(a, state.limitGroups, accounts)]));
    return (id: string) => map.get(id) ?? null;
  }, [accounts, state.limitGroups]);
}

export function useBudget() {
  const { state } = useStore();
  const { transactions, mainCurrency } = useLedger();
  // Tanggal ikut kunci cache: aplikasi yang terbuka melewati tengah malam (mis. masuk hari gajian) memakai periode baru.
  const today = todayYmd();
  return useMemo(() => {
    const period = budgetPeriod(today, state.payday);
    // Anggaran tersimpan untuk periode ini (FR-BDG-5); tanpa baris = penghasilan profil, tanpa batas kategori.
    const record = budgetFor(state.budgets, period.start);
    const previous = previousBudgets(state.budgets, period.start, 3);
    const total = record?.total ?? state.income;
    const byCategory = spendByCategory(transactions, period, mainCurrency);
    const spent = spendByBucket(byCategory);
    const limits = bucketLimits(total, state.split);
    const flexLimit = limits.needs + limits.wants;
    const flexSpent = spent.needs + spent.wants;
    const catSpent = new Map(byCategory.map((c) => [c.categoryKey, c.spent]));
    const categoryLimits = record?.categoryLimits ?? {};
    return {
      period,
      income: state.income,
      total,
      record,
      /** Periode lalu terbaru (untuk "Salin bulan lalu"). */
      lastPeriod: previous[0] ?? null,
      /** Saran rata-rata hingga 3 periode lalu. */
      suggestion: averageBudget(previous, mainCurrency),
      limits,
      spent,
      byCategory,
      categoryLimits,
      categorySpent: (key: string) => catSpent.get(key) ?? 0,
      flexLimit,
      flexSpent,
      flexPace: pace(flexSpent, flexLimit, period.elapsedDays, period.totalDays),
      bucketPace: (b: 'needs' | 'wants' | 'savings') => pace(spent[b], limits[b], period.elapsedDays, period.totalDays),
      safePerDay: safeToSpend(flexLimit, flexSpent, period.daysLeft),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, state.payday, state.income, state.split, state.budgets, transactions, mainCurrency, state.ratesDate, state.ratesVersion, state.userRates, state.categories]);
}

export function useHealth() {
  const { accounts, transactions, mainCurrency } = useLedger();
  const budget = useBudget();
  const planning = usePlanningOptional();
  const bills = planning?.status === 'ready' ? planning.bills : null;
  return useMemo(() => {
    const limited = Object.keys(budget.categoryLimits);
    const within = limited.filter((k) => budget.categorySpent(k) <= budget.categoryLimits[k]).length;
    const liquid = accounts.reduce((s, a) => s + (tryConvert(a.balance, a.currency, mainCurrency) ?? 0), 0);
    // Rata-rata pengeluaran bulanan = proyeksi periode berjalan; pada awal periode (belanja 0) jatuh ke 30 hari terakhir.
    let projected = Math.round((budget.flexSpent * budget.period.totalDays) / budget.period.elapsedDays);
    if (projected === 0 && transactions.length > 0) {
      const today = todayYmd();
      const tailPeriod = { start: addDays(today, -29), end: today, totalDays: 30, elapsedDays: 30, daysLeft: 1 };
      const tailSpent = spendByBucket(spendByCategory(transactions, tailPeriod, mainCurrency));
      projected = tailSpent.needs + tailSpent.wants;
    }
    let billsDue = 0;
    let billsOnTime = 0;
    if (bills && bills.length > 0) {
      const [sy, sm] = budget.period.start.split('-').map(Number);
      const [ey, em] = budget.period.end.split('-').map(Number);
      const today = todayYmd();
      for (const b of bills) {
        const occ = occurrencesInMonth(b.dueDate, b.frequency, b.anchorDay, sy!, sm!);
        if (sy !== ey || sm !== em) occ.push(...occurrencesInMonth(b.dueDate, b.frequency, b.anchorDay, ey!, em!));
        const inPeriod = [...new Set(occ)].filter((d) => d >= budget.period.start && d <= budget.period.end && (d <= today || b.paidPeriods.includes(d)));
        for (const d of inPeriod) {
          billsDue++;
          if (b.paidPeriods.includes(d)) billsOnTime++;
        }
      }
    }
    const inputs = {
      income: transactions.length === 0 ? 0 : budget.income,
      saved: budget.categorySpent('savings'),
      budgetedCategories: limited.length,
      withinBudget: within,
      debtPayments: budget.categorySpent('debt'),
      liquidBalance: liquid,
      monthlyExpense: projected,
      billsDue,
      billsOnTime,
    };
    const score = transactions.length === 0 ? null : healthScore(inputs);
    return { inputs, score, pillars: healthPillars(inputs), delta: 0 }; // belum ada riwayat skor bulanan: baris naik/turun disembunyikan
  }, [accounts, transactions, mainCurrency, budget, bills]);
}
