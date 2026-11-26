import type { Bill, Subscription } from '@/data/planning';
import type { Account, Transaction } from '@/data/types';
import { budgetPeriod } from '@/lib/budget';
import { addDays } from '@/lib/dates';
import { tryConvert } from '@/lib/fx';
import { accountBalance } from '@/lib/transactions';

import { billGroup } from './bills';
import { nextDue } from './schedule';

export type AccountPaydayProjection = {
  account: Account;
  currentBalance: number;
  dueAmount: number;
  projectedBalance: number;
  shortfall: number;
  itemCount: number;
  skippedRates: number;
};

export type PaydayCycleProjection = {
  periodEnd: string;
  nextPayday: string;
  accounts: AccountPaydayProjection[];
  unassignedDueMain: number;
  unassignedCount: number;
  totalDueMain: number;
  totalItems: number;
  shortfallAccountsCount: number;
  skippedRates: number;
};

type DueItem = { amount: number; currency: string; accountId?: string };

/**
 * Proyeksi kewajiban tagihan & langganan aktif hingga sehari sebelum tanggal gajian berikutnya (`payday`).
 * Menghubungkan nominal jatuh tempo langsung ke saldo akun tertaut agar potensi kurang dana terlihat dini.
 */
export function computePaydayProjection(input: {
  bills: Bill[];
  subscriptions: Subscription[];
  accounts: Account[];
  transactions: Transaction[];
  today: string;
  payday: number;
  mainCurrency: string;
}): PaydayCycleProjection {
  const period = budgetPeriod(input.today, input.payday);
  const periodEnd = period.end;
  const nextPayday = addDays(periodEnd, 1);

  const items: DueItem[] = [];
  for (const b of input.bills) {
    if (billGroup(b, input.today) === 'paid') continue;
    let d = b.dueDate;
    let guard = 0;
    while (d <= periodEnd && guard++ < 10) {
      if (!b.paidPeriods.includes(d)) {
        items.push({ amount: b.amount, currency: b.currency, accountId: b.accountId });
      }
      const nxt = nextDue(d, b.frequency, b.anchorDay);
      if (nxt <= d) break;
      d = nxt;
    }
  }

  for (const s of input.subscriptions) {
    if (s.status !== 'active') continue;
    let d = s.nextRenewal;
    let guard = 0;
    while (d < input.today && guard++ < 60) {
      const nxt = nextDue(d, s.cycle, s.anchorDay);
      if (nxt <= d) break;
      d = nxt;
    }
    while (d <= periodEnd && guard++ < 72) {
      items.push({ amount: s.amount, currency: s.currency, accountId: s.accountId });
      const nxt = nextDue(d, s.cycle, s.anchorDay);
      if (nxt <= d) break;
      d = nxt;
    }
  }

  const accById = new Map(input.accounts.map((a) => [a.id, a]));
  const perAcc = new Map<string, { due: number; count: number; skipped: number }>();
  let unassignedDueMain = 0;
  let unassignedCount = 0;
  let totalDueMain = 0;
  let globalSkipped = 0;

  for (const it of items) {
    const mainVal = it.currency === input.mainCurrency ? it.amount : tryConvert(it.amount, it.currency, input.mainCurrency);
    if (mainVal !== null) totalDueMain += mainVal;
    else globalSkipped += 1;

    const acc = it.accountId ? accById.get(it.accountId) : undefined;
    if (!acc) {
      unassignedCount += 1;
      if (mainVal !== null) unassignedDueMain += mainVal;
      continue;
    }

    const row = perAcc.get(acc.id) ?? { due: 0, count: 0, skipped: 0 };
    row.count += 1;
    const accVal = it.currency === acc.currency ? it.amount : tryConvert(it.amount, it.currency, acc.currency);
    if (accVal !== null) row.due += accVal;
    else row.skipped += 1;
    perAcc.set(acc.id, row);
  }

  const accounts: AccountPaydayProjection[] = [];
  let shortfallAccountsCount = 0;
  for (const [id, row] of perAcc) {
    const account = accById.get(id)!;
    const currentBalance = accountBalance(account, input.transactions);
    const projectedBalance = currentBalance - row.due;
    const shortfall = Math.max(0, -projectedBalance);
    if (shortfall > 0) shortfallAccountsCount += 1;
    accounts.push({
      account,
      currentBalance,
      dueAmount: row.due,
      projectedBalance,
      shortfall,
      itemCount: row.count,
      skippedRates: row.skipped,
    });
  }

  accounts.sort((a, b) => b.shortfall - a.shortfall || b.dueAmount - a.dueAmount);

  return {
    periodEnd,
    nextPayday,
    accounts,
    unassignedDueMain,
    unassignedCount,
    totalDueMain,
    totalItems: items.length,
    shortfallAccountsCount,
    skippedRates: globalSkipped,
  };
}
