import { useMemo } from 'react';

import { todayYmd } from '@/lib/dates';
import { missingRates, tryConvert } from '@/lib/fx';
import {
  averageBudget, budgetFor, bucketLimits, budgetPeriod, pace, previousBudgets, safeToSpend, spendByBucket, spendByCategory,
} from '@/lib/budget';
import { cardUtilization } from '@/lib/credit';
import { healthPillars, healthScore } from '@/lib/health';
import { accountBalance } from '@/lib/transactions';

import type { Transaction } from '@/data/types';

import { usedCodes, useStore, type AccountWithBalance } from './AppStore';

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
  return useMemo(
    () => missingRates(usedCodes(state.accounts, state.transactions, state.mainCurrency, state.limitGroups.map((g) => g.currency))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.accounts, state.transactions, state.mainCurrency, state.limitGroups, state.ratesDate, state.ratesVersion, state.userRates],
  );
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
  }, [today, state.payday, state.income, state.split, state.budgets, transactions, mainCurrency]);
}

export function useHealth() {
  const { accounts, transactions, mainCurrency } = useLedger();
  const budget = useBudget();
  return useMemo(() => {
    const limited = Object.keys(budget.categoryLimits);
    const within = limited.filter((k) => budget.categorySpent(k) <= budget.categoryLimits[k]).length;
    const liquid = accounts.reduce((s, a) => s + (tryConvert(a.balance, a.currency, mainCurrency) ?? 0), 0);
    // Rata-rata pengeluaran bulanan = belanja periode berjalan diproyeksikan ke satu periode penuh.
    const projected = Math.round((budget.flexSpent * budget.period.totalDays) / budget.period.elapsedDays);
    const inputs = {
      income: transactions.length === 0 ? 0 : budget.income,
      saved: budget.categorySpent('savings'),
      budgetedCategories: limited.length,
      withinBudget: within,
      debtPayments: budget.categorySpent('debt'),
      liquidBalance: liquid,
      monthlyExpense: projected,
      // Modul Tagihan belum ada (di luar layar inti): pilar tagihan penuh sampai ada data tagihan.
      billsDue: 0,
      billsOnTime: 0,
    };
    const score = transactions.length === 0 ? null : healthScore(inputs);
    return { inputs, score, pillars: healthPillars(inputs), delta: 0 }; // belum ada riwayat skor bulanan: baris naik/turun disembunyikan
  }, [accounts, transactions, mainCurrency, budget]);
}
