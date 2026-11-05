import type { Bill, Debt, DebtPayment, Goal, GoalDeposit, SplitBill, SplitItem, SplitParticipant, Subscription } from '@/data/planning';
import type { QuotaKey } from '@/lib/quota';
import { supabase } from '@/lib/supabase';

import { RemoteError } from './api';

/** Penulisan ditolak karena batas paket (trigger enforce_total_limit). Layar membuka paywall, bukan error mentah. */
export class QuotaError extends Error {
  constructor(readonly key: QuotaKey) {
    super(`quota_${key}`);
  }
}

type Res<T> = { data: T | null; error: { message: string; code?: string } | null };
function check<T>(res: Res<T>): T | null {
  if (res.error) {
    const quota = /quota_(goals|billsDebts|subscriptions)/.exec(res.error.message);
    if (quota) throw new QuotaError(quota[1] as QuotaKey);
    throw new RemoteError(res.error.message, res.error.code);
  }
  return res.data;
}
function must<T>(res: Res<T>): T {
  const data = check(res);
  if (data === null) throw new RemoteError('empty_result');
  return data;
}

const opt = <T,>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);
const num = (v: unknown): number => Number(v);

// ------------------------------------------------------------------ baris DB -> domain
type GoalRow = { id: string; name: string; target: number; currency: string; deadline: string | null; account_id: string | null; collected: number; status: Goal['status']; completed_at: string | null };
type DepositRow = { id: string; goal_id: string; amount: number; date: string; account_id: string | null; transaction_id: string | null };
type BillRow = { id: string; name: string; amount: number; currency: string; frequency: Bill['frequency']; due_date: string; anchor_day: number; account_id: string | null; category_key: string; paid_periods: string[] };
type DebtRow = {
  id: string; kind: Debt['kind']; counterparty: string; contact: string | null; principal: number; balance: number; apr_bp: number; min_payment: number;
  currency: string; due_date: string | null; note: string | null; split_bill_id: string | null; status: Debt['status'];
};
type PaymentRow = { id: string; debt_id: string; amount: number; date: string; transaction_id: string | null };
type SubRow = {
  id: string; name: string; preset: string | null; amount: number; currency: string; cycle: Subscription['cycle']; next_renewal: string; anchor_day: number;
  account_id: string | null; category_key: string; status: Subscription['status'];
};
type SplitRow = {
  id: string; title: string; currency: string; total: number; tax: number; service: number; mode: SplitBill['mode']; date: string;
  transaction_id: string | null; items: SplitItem[]; participants: SplitParticipant[];
};

export const toGoal = (r: GoalRow): Goal => ({
  id: r.id, name: r.name, target: num(r.target), currency: r.currency, deadline: opt(r.deadline), accountId: opt(r.account_id),
  collected: num(r.collected), status: r.status, completedAt: opt(r.completed_at),
});
const toDeposit = (r: DepositRow): GoalDeposit => ({ id: r.id, goalId: r.goal_id, amount: num(r.amount), date: r.date, accountId: opt(r.account_id), transactionId: opt(r.transaction_id) });
export const toBill = (r: BillRow): Bill => ({
  id: r.id, name: r.name, amount: num(r.amount), currency: r.currency, frequency: r.frequency, dueDate: r.due_date, anchorDay: r.anchor_day,
  accountId: opt(r.account_id), categoryKey: r.category_key, paidPeriods: r.paid_periods ?? [],
});
export const toDebt = (r: DebtRow): Debt => ({
  id: r.id, kind: r.kind, counterparty: r.counterparty, contact: opt(r.contact), principal: num(r.principal), balance: num(r.balance), aprBp: r.apr_bp,
  minPayment: num(r.min_payment), currency: r.currency, dueDate: opt(r.due_date), note: opt(r.note), splitBillId: opt(r.split_bill_id), status: r.status,
});
const toPayment = (r: PaymentRow): DebtPayment => ({ id: r.id, debtId: r.debt_id, amount: num(r.amount), date: r.date, transactionId: opt(r.transaction_id) });
export const toSub = (r: SubRow): Subscription => ({
  id: r.id, name: r.name, preset: opt(r.preset), amount: num(r.amount), currency: r.currency, cycle: r.cycle, nextRenewal: r.next_renewal,
  anchorDay: r.anchor_day, accountId: opt(r.account_id), categoryKey: r.category_key, status: r.status,
});
// jsonb dari klien sendiri, tetap dibaca defensif: entri rusak dibuang.
const toSplit = (r: SplitRow): SplitBill => ({
  id: r.id, title: r.title, currency: r.currency, total: num(r.total), tax: num(r.tax), service: num(r.service), mode: r.mode, date: r.date,
  transactionId: opt(r.transaction_id),
  items: (Array.isArray(r.items) ? r.items : []).filter((i) => i && typeof i.name === 'string').map((i) => ({ id: String(i.id), name: i.name, amount: num(i.amount), assigned: Array.isArray(i.assigned) ? i.assigned.map(String) : [] })),
  participants: (Array.isArray(r.participants) ? r.participants : []).filter((p) => p && typeof p.name === 'string').map((p) => ({
    id: String(p.id), name: p.name, contact: opt(p.contact), owner: !!p.owner, share: num(p.share), paidAt: opt(p.paidAt), debtId: opt(p.debtId),
  })),
});

export type PlanningData = {
  goals: Goal[];
  deposits: GoalDeposit[];
  bills: Bill[];
  debts: Debt[];
  payments: DebtPayment[];
  subscriptions: Subscription[];
  splits: SplitBill[];
};

export async function loadPlanning(): Promise<PlanningData> {
  const [goals, deposits, bills, debts, payments, subs, splits] = await Promise.all([
    supabase.from('goals').select('*').order('created_at').returns<GoalRow[]>(),
    supabase.from('goal_deposits').select('*').order('date', { ascending: false }).limit(1000).returns<DepositRow[]>(),
    supabase.from('bills').select('*').order('due_date').returns<BillRow[]>(),
    supabase.from('debts').select('*').order('created_at').returns<DebtRow[]>(),
    supabase.from('debt_payments').select('*').order('date', { ascending: false }).limit(1000).returns<PaymentRow[]>(),
    supabase.from('subscriptions').select('*').order('next_renewal').returns<SubRow[]>(),
    supabase.from('split_bills').select('*').order('date', { ascending: false }).limit(200).returns<SplitRow[]>(),
  ]);
  return {
    goals: must(goals).map(toGoal),
    deposits: must(deposits).map(toDeposit),
    bills: must(bills).map(toBill),
    debts: must(debts).map(toDebt),
    payments: must(payments).map(toPayment),
    subscriptions: must(subs).map(toSub),
    splits: must(splits).map(toSplit),
  };
}

// ------------------------------------------------------------------ goals
export type GoalInput = Pick<Goal, 'name' | 'target' | 'currency' | 'deadline' | 'accountId'>;
const goalCols = (g: GoalInput) => ({ name: g.name, target: g.target, deadline: g.deadline ?? null, account_id: g.accountId ?? null });

export async function insertGoal(id: string, g: GoalInput): Promise<Goal> {
  return toGoal(must(await supabase.from('goals').insert({ id, currency: g.currency, ...goalCols(g) }).select('*').single<GoalRow>()));
}
export async function updateGoal(id: string, g: GoalInput): Promise<Goal> {
  return toGoal(must(await supabase.from('goals').update(goalCols(g)).eq('id', id).select('*').single<GoalRow>()));
}
export async function deleteGoal(id: string): Promise<void> {
  check(await supabase.from('goals').delete().eq('id', id));
}
export async function insertDeposit(d: Omit<GoalDeposit, 'id'> & { id: string }): Promise<{ deposit: GoalDeposit; goal: Goal }> {
  const deposit = toDeposit(
    must(
      await supabase
        .from('goal_deposits')
        .insert({ id: d.id, goal_id: d.goalId, amount: d.amount, date: d.date, account_id: d.accountId ?? null, transaction_id: d.transactionId ?? null })
        .select('*')
        .single<DepositRow>(),
    ),
  );
  const goal = toGoal(must(await supabase.from('goals').select('*').eq('id', d.goalId).single<GoalRow>()));
  return { deposit, goal };
}

// ------------------------------------------------------------------ bills
export type BillInput = Omit<Bill, 'id' | 'paidPeriods'>;
const billCols = (b: BillInput) => ({
  name: b.name, amount: b.amount, currency: b.currency, frequency: b.frequency, due_date: b.dueDate, anchor_day: b.anchorDay,
  account_id: b.accountId ?? null, category_key: b.categoryKey,
});
export async function insertBill(id: string, b: BillInput): Promise<Bill> {
  return toBill(must(await supabase.from('bills').insert({ id, ...billCols(b) }).select('*').single<BillRow>()));
}
export async function updateBill(id: string, b: BillInput): Promise<Bill> {
  return toBill(must(await supabase.from('bills').update(billCols(b)).eq('id', id).select('*').single<BillRow>()));
}
export async function deleteBill(id: string): Promise<void> {
  check(await supabase.from('bills').delete().eq('id', id));
}
/** Setelah transaksi pengeluarannya tersimpan: catat periode lunas + majukan jatuh tempo (atomik di server). */
export async function billMarkPaid(billId: string, transactionId: string): Promise<{ dueDate: string; paidPeriods: string[] }> {
  const rows = must(await supabase.rpc('bill_mark_paid', { p_bill: billId, p_transaction: transactionId })) as { due_date: string; paid_periods: string[] }[];
  if (!rows[0]) throw new RemoteError('empty_result');
  return { dueDate: rows[0].due_date, paidPeriods: rows[0].paid_periods };
}

// ------------------------------------------------------------------ debts
export type DebtInput = Pick<Debt, 'kind' | 'counterparty' | 'contact' | 'principal' | 'aprBp' | 'minPayment' | 'currency' | 'dueDate' | 'note' | 'splitBillId'>;
export async function insertDebt(id: string, d: DebtInput): Promise<Debt> {
  return toDebt(
    must(
      await supabase
        .from('debts')
        .insert({
          id, kind: d.kind, counterparty: d.counterparty, contact: d.contact ?? null, principal: d.principal, apr_bp: d.aprBp, min_payment: d.minPayment,
          currency: d.currency, due_date: d.dueDate ?? null, note: d.note ?? null, split_bill_id: d.splitBillId ?? null,
        })
        .select('*')
        .single<DebtRow>(),
    ),
  );
}
export async function updateDebt(id: string, d: Pick<Debt, 'counterparty' | 'contact' | 'aprBp' | 'minPayment' | 'dueDate' | 'note'>): Promise<Debt> {
  return toDebt(
    must(
      await supabase
        .from('debts')
        .update({ counterparty: d.counterparty, contact: d.contact ?? null, apr_bp: d.aprBp, min_payment: d.minPayment, due_date: d.dueDate ?? null, note: d.note ?? null })
        .eq('id', id)
        .select('*')
        .single<DebtRow>(),
    ),
  );
}
export async function deleteDebt(id: string): Promise<void> {
  check(await supabase.from('debts').delete().eq('id', id));
}
export async function insertPayment(p: DebtPayment): Promise<{ payment: DebtPayment; debt: Debt }> {
  const payment = toPayment(
    must(
      await supabase
        .from('debt_payments')
        .insert({ id: p.id, debt_id: p.debtId, amount: p.amount, date: p.date, transaction_id: p.transactionId ?? null })
        .select('*')
        .single<PaymentRow>(),
    ),
  );
  const debt = toDebt(must(await supabase.from('debts').select('*').eq('id', p.debtId).single<DebtRow>()));
  return { payment, debt };
}

// ------------------------------------------------------------------ subscriptions
export type SubInput = Omit<Subscription, 'id' | 'status'>;
const subCols = (s: SubInput) => ({
  name: s.name, amount: s.amount, currency: s.currency, cycle: s.cycle, next_renewal: s.nextRenewal, anchor_day: s.anchorDay,
  account_id: s.accountId ?? null, category_key: s.categoryKey,
});
export async function insertSub(id: string, s: SubInput): Promise<Subscription> {
  return toSub(must(await supabase.from('subscriptions').insert({ id, preset: s.preset ?? null, ...subCols(s) }).select('*').single<SubRow>()));
}
export async function updateSub(id: string, s: SubInput): Promise<Subscription> {
  return toSub(must(await supabase.from('subscriptions').update(subCols(s)).eq('id', id).select('*').single<SubRow>()));
}
export async function setSubStatus(id: string, status: Subscription['status']): Promise<Subscription> {
  return toSub(must(await supabase.from('subscriptions').update({ status }).eq('id', id).select('*').single<SubRow>()));
}
export async function deleteSub(id: string): Promise<void> {
  check(await supabase.from('subscriptions').delete().eq('id', id));
}

// ------------------------------------------------------------------ split bills
const splitCols = (s: SplitBill) => ({ title: s.title, total: s.total, tax: s.tax, service: s.service, mode: s.mode, items: s.items, participants: s.participants });
export async function insertSplit(s: SplitBill): Promise<SplitBill> {
  return toSplit(
    must(
      await supabase
        .from('split_bills')
        .insert({ id: s.id, currency: s.currency, date: s.date, transaction_id: s.transactionId ?? null, ...splitCols(s) })
        .select('*')
        .single<SplitRow>(),
    ),
  );
}
export async function updateSplit(s: SplitBill): Promise<SplitBill> {
  return toSplit(must(await supabase.from('split_bills').update(splitCols(s)).eq('id', s.id).select('*').single<SplitRow>()));
}
export async function deleteSplit(id: string): Promise<void> {
  check(await supabase.from('split_bills').delete().eq('id', id));
}

export async function setTimezone(userId: string, timezone: string): Promise<void> {
  check(await supabase.from('profiles').update({ timezone }).eq('id', userId));
}
