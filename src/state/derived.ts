import { useMemo } from 'react';

import { todayYmd } from '@/lib/dates';
import { convert } from '@/lib/fx';
import {
  bucketLimits, budgetPeriod, pace, safeToSpend, spendByBucket, spendByCategory,
} from '@/lib/budget';
import { healthPillars, healthScore } from '@/lib/health';
import { accountBalance, netWorth as computeNetWorth } from '@/lib/transactions';

import { useStore, type AccountWithBalance } from './AppStore';

/** Akun (dengan saldo) + transaksi + kekayaan bersih dalam mata uang utama. */
export function useLedger() {
  const { state } = useStore();
  return useMemo(() => {
    const accounts: AccountWithBalance[] = state.accounts.map((a) => ({ ...a, balance: accountBalance(a, state.transactions) }));
    return {
      accounts,
      transactions: state.transactions,
      mainCurrency: state.mainCurrency,
      netWorth: computeNetWorth(state.accounts, state.transactions, state.mainCurrency),
    };
    // ratesDate: kurs baru dimuat = konversi ke mata uang utama ikut berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.accounts, state.transactions, state.mainCurrency, state.ratesDate]);
}

/** Batas per kategori belum bisa diatur pengguna (FR-SET-2 di luar layar inti); kosong = tidak ada batas. */
const NO_CATEGORY_LIMITS: Record<string, number> = {};

export function useBudget() {
  const { state } = useStore();
  const { transactions, mainCurrency } = useLedger();
  return useMemo(() => {
    const period = budgetPeriod(todayYmd(), state.payday);
    const byCategory = spendByCategory(transactions, period, mainCurrency);
    const spent = spendByBucket(byCategory);
    const limits = bucketLimits(state.income, state.split);
    const flexLimit = limits.needs + limits.wants;
    const flexSpent = spent.needs + spent.wants;
    const catSpent = new Map(byCategory.map((c) => [c.categoryKey, c.spent]));
    return {
      period,
      income: state.income,
      limits,
      spent,
      byCategory,
      categoryLimits: NO_CATEGORY_LIMITS,
      categorySpent: (key: string) => catSpent.get(key) ?? 0,
      flexLimit,
      flexSpent,
      flexPace: pace(flexSpent, flexLimit, period.elapsedDays, period.totalDays),
      bucketPace: (b: 'needs' | 'wants' | 'savings') => pace(spent[b], limits[b], period.elapsedDays, period.totalDays),
      safePerDay: safeToSpend(flexLimit, flexSpent, period.daysLeft),
    };
  }, [state.payday, state.income, state.split, transactions, mainCurrency]);
}

export function useHealth() {
  const { accounts, transactions, mainCurrency } = useLedger();
  const budget = useBudget();
  return useMemo(() => {
    const limited = Object.keys(budget.categoryLimits);
    const within = limited.filter((k) => budget.categorySpent(k) <= budget.categoryLimits[k]).length;
    const liquid = accounts.reduce((s, a) => s + convert(a.balance, a.currency, mainCurrency), 0);
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
