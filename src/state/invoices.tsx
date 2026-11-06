import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { RemoteError } from '@/data/remote/api';
import * as api from '@/data/remote/invoices';
import { localHm } from '@/features/capture/clock';
import type { Invoice, InvoiceKind, InvoiceStatus } from '@/lib/invoice';
import { newId } from '@/lib/uuid';

import { useStore } from './AppStore';

export type InvoicesStatus = 'idle' | 'loading' | 'ready' | 'error';

type InvoicesValue = {
  status: InvoicesStatus;
  invoices: Invoice[];
  reload: () => Promise<void>;
  create: (kind: InvoiceKind, input: api.InvoiceInput) => Promise<Invoice>;
  update: (id: string, input: api.InvoiceInput) => Promise<Invoice>;
  setStatus: (id: string, status: Exclude<InvoiceStatus, 'paid'>) => Promise<Invoice>;
  remove: (id: string) => Promise<void>;
  /** Tandai Dibayar: satu transaksi pemasukan ke akun pilihan, dalam mata uang invoice. */
  markPaid: (inv: Invoice, p: { accountId: string; date: string }) => Promise<Invoice>;
};

const Ctx = createContext<InvoicesValue | null>(null);

const upsert = (list: Invoice[], item: Invoice): Invoice[] => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list]);

/**
 * Invoice & penawaran (FR-INV). Dimuat setelah data utama siap. Penomoran, kuota 5/bulan, dan kunci "Dibayar"
 * ditegakkan server; layar hanya menampilkan hasilnya. `preset` = data tetap tanpa server (test).
 */
export function InvoicesProvider({ children, preset }: { children: ReactNode; preset?: Invoice[] }) {
  const { state: app, userId, commitTx, refreshUsage, reload: reloadApp } = useStore();
  const [status, setStatus] = useState<InvoicesStatus>(preset ? 'ready' : 'idle');
  const [invoices, setInvoices] = useState<Invoice[]>(preset ?? []);
  const paying = useRef(new Set<string>());

  const reload = useCallback(async () => {
    if (!userId) return;
    setStatus((s) => (s === 'ready' ? 'ready' : 'loading'));
    try {
      setInvoices(await api.loadInvoices());
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'));
    }
  }, [userId]);

  useEffect(() => {
    if (preset) return;
    if (!userId) {
      setInvoices([]);
      setStatus('idle');
      return;
    }
    if (app.status === 'ready' && app.onboarded) void reload();
  }, [userId, app.status, app.onboarded, reload, preset]);

  const markPaid = useCallback(
    async (inv: Invoice, p: { accountId: string; date: string }): Promise<Invoice> => {
      if (inv.status === 'paid') return inv;
      // Ketukan ganda: permintaan kedua ditolak selama yang pertama berjalan.
      if (paying.current.has(inv.id)) throw new RemoteError('invoice_paying');
      paying.current.add(inv.id);
      try {
        // id transaksi = id invoice: percobaan ulang tidak membuat transaksi kedua (server juga menolak id ganda).
        if (!app.transactions.some((t) => t.id === inv.id)) {
          try {
            await commitTx({
              id: inv.id, type: 'income', merchant: inv.clientName, categoryKey: 'freelance', accountId: p.accountId, date: p.date,
              time: localHm(), amount: inv.total, currency: inv.currency, note: inv.number, source: 'invoice',
            });
          } catch (e) {
            if (!(e instanceof RemoteError && e.code === '23505')) throw e;
            void reloadApp();
          }
        }
        const next = await api.invoiceMarkPaid(inv.id, inv.id);
        setInvoices((l) => upsert(l, next));
        return next;
      } finally {
        paying.current.delete(inv.id);
      }
    },
    [commitTx, reloadApp, app.transactions],
  );

  const value = useMemo<InvoicesValue>(
    () => ({
      status,
      invoices,
      reload,
      create: async (kind, input) => {
        try {
          const inv = await api.insertInvoice(newId(), kind, input);
          setInvoices((l) => upsert(l, inv));
          return inv;
        } finally {
          refreshUsage();
        }
      },
      update: async (id, input) => {
        const inv = await api.updateInvoice(id, input);
        setInvoices((l) => upsert(l, inv));
        return inv;
      },
      setStatus: async (id, s) => {
        const inv = await api.setInvoiceStatus(id, s);
        setInvoices((l) => upsert(l, inv));
        return inv;
      },
      remove: async (id) => {
        await api.deleteInvoice(id);
        setInvoices((l) => l.filter((x) => x.id !== id));
      },
      markPaid,
    }),
    [status, invoices, reload, refreshUsage, markPaid],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInvoices(): InvoicesValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInvoices harus dipakai di dalam <InvoicesProvider>');
  return ctx;
}
