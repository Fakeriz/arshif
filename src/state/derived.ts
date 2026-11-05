import { useMemo } from 'react';

import { DEMO_BILLS, DEMO_CATEGORY_LIMITS, DEMO_PREVIOUS_SCORE } from '@/data/seed';
import { DEMO_TODAY } from '@/lib/dates';
import { convert } from '@/lib/fx';
import {
  bucketLimits, budgetPeriod, pace, safeToSpend, spendByBucket, spendByCategory,
} from '@/lib/budget';
import { healthPillars, healthScore } from '@/lib/health';
import { accountBalance, netWorth as computeNetWorth } from '@/lib/transactions';

import { useStore, type AccountWithBalance } from './AppStore';
import { useDemoState } from './demo';

/** Akun + transaksi yang dilihat layar. `?state=empty` meniru pengguna baru: satu akun kosong, tanpa transaksi. */
export function useLedger() {
  const { state } = useStore();
  const demo = useDemoState();
  return useMemo(() => {
    const transactions = demo === 'empty' ? [] : state.transactions;
    const base = demo === 'empty' ? state.accounts.slice(0, 1).map((a) => ({ ...a, openingBalance: 0 })) : state.accounts;
    const accounts: AccountWithBalance[] = base.map((a) => ({ ...a, balance: accountBalance(a, transactions) }));
    return {
      accounts,
      transactions,
      mainCurrency: state.mainCurrency,
      netWorth: computeNetWorth(base, transactions, state.mainCurrency),
    };
  }, [state.accounts, state.transactions, state.mainCurrency, demo]);
}

export function useBudget() {
  const { state } = useStore();
  const { transactions, mainCurrency } = useLedger();
  return useMemo(() => {
    const period = budgetPeriod(DEMO_TODAY, state.payday);
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
      categoryLimits: DEMO_CATEGORY_LIMITS,
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
      billsDue: DEMO_BILLS.due,
      billsOnTime: DEMO_BILLS.onTime,
    };
    const score = transactions.length === 0 ? null : healthScore(inputs);
    return { inputs, score, pillars: healthPillars(inputs), delta: score === null ? 0 : score - DEMO_PREVIOUS_SCORE };
  }, [accounts, transactions, mainCurrency, budget]);
}
