import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { Bill, Debt, Goal, SplitBill, Subscription } from '@/data/planning';
import * as api from '@/data/remote/planning';
import type { Transaction } from '@/data/types';
import { localHm } from '@/features/capture/clock';
import { RemoteError } from '@/data/remote/api';
import { newId } from '@/lib/uuid';

import { useStore } from './AppStore';

export type PlanningStatus = 'idle' | 'loading' | 'ready' | 'error';
type PlanningState = api.PlanningData & { status: PlanningStatus };

const EMPTY: PlanningState = { status: 'idle', goals: [], deposits: [], bills: [], debts: [], payments: [], subscriptions: [], splits: [] };

/** Pembayaran dari akun: nominal dalam mata uang entitas, akun boleh beda mata uang (dikonversi store). */
/**
 * `id` dibuat sekali per lembar bayar (PaySheet) dan dipakai untuk transaksi + catatan setoran/pembayarannya.
 * Coba ulang setelah gagal di tengah jalan memakai id yang sama, jadi rekening tidak terpotong dua kali.
 */
export type PayInput = { id: string; amount: number; accountId: string; date: string; note?: string };

/** Catatan dengan id ini sudah tersimpan di percobaan sebelumnya (unique violation). */
const alreadySaved = (e: unknown) => e instanceof RemoteError && e.code === '23505';

type PlanningValue = PlanningState & {
  reload: () => Promise<void>;
  addGoal: (g: api.GoalInput) => Promise<Goal>;
  editGoal: (id: string, g: api.GoalInput) => Promise<Goal>;
  removeGoal: (id: string) => Promise<void>;
  depositGoal: (goal: Goal, p: PayInput) => Promise<Goal>;
  addBill: (b: api.BillInput) => Promise<Bill>;
  editBill: (id: string, b: api.BillInput) => Promise<Bill>;
  removeBill: (id: string) => Promise<void>;
  payBill: (bill: Bill, p: PayInput) => Promise<Bill>;
  addDebt: (d: api.DebtInput) => Promise<Debt>;
  editDebt: (id: string, d: Parameters<typeof api.updateDebt>[1]) => Promise<Debt>;
  removeDebt: (id: string) => Promise<void>;
  payDebt: (debt: Debt, p: PayInput) => Promise<Debt>;
  /** Tutup piutang tanpa transaksi (peserta split bill menandai sudah bayar). */
  settleDebt: (debt: Debt, date: string) => Promise<Debt>;
  addSub: (s: api.SubInput) => Promise<Subscription>;
  editSub: (id: string, s: api.SubInput) => Promise<Subscription>;
  setSubStatus: (id: string, status: Subscription['status']) => Promise<Subscription>;
  removeSub: (id: string) => Promise<void>;
  saveSplit: (s: SplitBill, isNew: boolean) => Promise<SplitBill>;
  removeSplit: (id: string) => Promise<void>;
};

const PlanningContext = createContext<PlanningValue | null>(null);

const upsert = <T extends { id: string }>(list: T[], item: T): T[] => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);
const without = <T extends { id: string }>(list: T[], id: string): T[] => list.filter((x) => x.id !== id);

/**
 * `preset` = data tetap tanpa server (test dan pratinjau).
 * Data Planning hub (goals, tagihan, utang, langganan, split bill). Dimuat sekali setelah data utama siap.
 * Tiap mutasi menunggu server lalu memperbarui layar; transaksi yang menyertainya lewat commitTx di AppStore,
 * jadi saldo akun dan anggaran ikut berubah.
 */
export function PlanningProvider({ children, preset }: { children: ReactNode; preset?: api.PlanningData }) {
  const { state: app, userId, commitTx, refreshUsage } = useStore();
  const [state, setState] = useState<PlanningState>(() => (preset ? { ...preset, status: 'ready' } : EMPTY));
  const tzSent = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'loading' }));
    try {
      const data = await api.loadPlanning();
      setState({ ...data, status: 'ready' });
    } catch {
      setState((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'error' }));
    }
  }, [userId]);

  useEffect(() => {
    if (preset) return;
    if (!userId) {
      setState(EMPTY);
      return;
    }
    if (app.status === 'ready' && app.onboarded) void reload();
  }, [userId, app.status, app.onboarded, reload, preset]);

  // Zona waktu perangkat untuk pengingat jam 07.00 lokal (server mengabaikan nilai yang tidak dikenal).
  useEffect(() => {
    if (!userId || app.status !== 'ready') return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || tzSent.current === `${userId}:${tz}`) return;
    tzSent.current = `${userId}:${tz}`;
    api.setTimezone(userId, tz).catch(() => undefined);
  }, [userId, app.status]);

  const tx = useCallback(
    async (p: PayInput, fields: Pick<Transaction, 'type' | 'merchant' | 'categoryKey' | 'currency'>): Promise<Transaction> => {
      // Transaksi sudah tersimpan di percobaan sebelumnya (catatan keduanya yang gagal): jangan buat lagi.
      const existing = app.transactions.find((t) => t.id === p.id);
      if (existing) return existing;
      return commitTx({ id: p.id, ...fields, accountId: p.accountId, date: p.date, time: localHm(), amount: p.amount, note: p.note, source: 'manual' });
    },
    [commitTx, app.transactions],
  );

  const value = useMemo<PlanningValue>(() => {
    const set = (fn: (s: PlanningState) => PlanningState) => setState(fn);
    return {
      ...state,
      reload,
      addGoal: async (g) => {
        const goal = await api.insertGoal(newId(), g);
        set((s) => ({ ...s, goals: upsert(s.goals, goal) }));
        refreshUsage();
        return goal;
      },
      editGoal: async (id, g) => {
        const goal = await api.updateGoal(id, g);
        set((s) => ({ ...s, goals: upsert(s.goals, goal) }));
        return goal;
      },
      removeGoal: async (id) => {
        await api.deleteGoal(id);
        set((s) => ({ ...s, goals: without(s.goals, id), deposits: s.deposits.filter((d) => d.goalId !== id) }));
        refreshUsage();
      },
      depositGoal: async (goal, p) => {
        const t = await tx(p, { type: 'expense', merchant: goal.name, categoryKey: 'savings', currency: goal.currency });
        let saved;
        try {
          saved = await api.insertDeposit({ id: p.id, goalId: goal.id, amount: p.amount, date: p.date, accountId: p.accountId, transactionId: t.id });
        } catch (e) {
          if (!alreadySaved(e)) throw e;
          await reload();
          return goal;
        }
        const { deposit, goal: next } = saved;
        set((s) => ({ ...s, goals: upsert(s.goals, next), deposits: [deposit, ...s.deposits] }));
        if (next.status !== goal.status) refreshUsage();
        return next;
      },
      addBill: async (b) => {
        const bill = await api.insertBill(newId(), b);
        set((s) => ({ ...s, bills: upsert(s.bills, bill) }));
        refreshUsage();
        return bill;
      },
      editBill: async (id, b) => {
        const bill = await api.updateBill(id, b);
        set((s) => ({ ...s, bills: upsert(s.bills, bill) }));
        return bill;
      },
      removeBill: async (id) => {
        await api.deleteBill(id);
        set((s) => ({ ...s, bills: without(s.bills, id) }));
        refreshUsage();
      },
      payBill: async (bill, p) => {
        const t = await tx(p, { type: 'expense', merchant: bill.name, categoryKey: bill.categoryKey, currency: bill.currency });
        const r = await api.billMarkPaid(bill.id, t.id);
        const next = { ...bill, dueDate: r.dueDate, paidPeriods: r.paidPeriods };
        set((s) => ({ ...s, bills: upsert(s.bills, next) }));
        return next;
      },
      addDebt: async (d) => {
        const debt = await api.insertDebt(newId(), d);
        set((s) => ({ ...s, debts: upsert(s.debts, debt) }));
        refreshUsage();
        return debt;
      },
      editDebt: async (id, d) => {
        const debt = await api.updateDebt(id, d);
        set((s) => ({ ...s, debts: upsert(s.debts, debt) }));
        return debt;
      },
      removeDebt: async (id) => {
        await api.deleteDebt(id);
        set((s) => ({ ...s, debts: without(s.debts, id), payments: s.payments.filter((x) => x.debtId !== id) }));
        refreshUsage();
      },
      payDebt: async (debt, p) => {
        // Utang: uang keluar. Piutang: uang masuk dari pihak lawan.
        const t = await tx(p, { type: debt.kind === 'debt' ? 'expense' : 'income', merchant: debt.counterparty, categoryKey: debt.kind === 'debt' ? 'debt' : 'other', currency: debt.currency });
        let saved;
        try {
          saved = await api.insertPayment({ id: p.id, debtId: debt.id, amount: p.amount, date: p.date, transactionId: t.id });
        } catch (e) {
          if (!alreadySaved(e)) throw e;
          await reload();
          return debt;
        }
        const { payment, debt: next } = saved;
        set((s) => ({ ...s, debts: upsert(s.debts, next), payments: [payment, ...s.payments] }));
        if (next.status !== debt.status) refreshUsage();
        return next;
      },
      settleDebt: async (debt, date) => {
        if (debt.balance <= 0) return debt;
        const { payment, debt: next } = await api.insertPayment({ id: newId(), debtId: debt.id, amount: debt.balance, date });
        set((s) => ({ ...s, debts: upsert(s.debts, next), payments: [payment, ...s.payments] }));
        refreshUsage();
        return next;
      },
      addSub: async (sub) => {
        const s1 = await api.insertSub(newId(), sub);
        set((s) => ({ ...s, subscriptions: upsert(s.subscriptions, s1) }));
        refreshUsage();
        return s1;
      },
      editSub: async (id, sub) => {
        const s1 = await api.updateSub(id, sub);
        set((s) => ({ ...s, subscriptions: upsert(s.subscriptions, s1) }));
        return s1;
      },
      setSubStatus: async (id, status) => {
        const s1 = await api.setSubStatus(id, status);
        set((s) => ({ ...s, subscriptions: upsert(s.subscriptions, s1) }));
        refreshUsage();
        return s1;
      },
      removeSub: async (id) => {
        await api.deleteSub(id);
        set((s) => ({ ...s, subscriptions: without(s.subscriptions, id) }));
        refreshUsage();
      },
      saveSplit: async (split, isNew) => {
        const saved = isNew ? await api.insertSplit(split) : await api.updateSplit(split);
        set((s) => ({ ...s, splits: [saved, ...without(s.splits, saved.id)] }));
        return saved;
      },
      removeSplit: async (id) => {
        await api.deleteSplit(id);
        set((s) => ({ ...s, splits: without(s.splits, id) }));
      },
    };
  }, [state, reload, tx, refreshUsage]);

  return <PlanningContext.Provider value={value}>{children}</PlanningContext.Provider>;
}

export function usePlanning(): PlanningValue {
  const ctx = useContext(PlanningContext);
  if (!ctx) throw new Error('usePlanning harus dipakai di dalam <PlanningProvider>');
  return ctx;
}
