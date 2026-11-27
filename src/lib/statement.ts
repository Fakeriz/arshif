import type { Account, Transaction } from '@/data/types';
import { todayYmd } from '@/lib/dates';
import { tryConvert } from '@/lib/fx';
import { rustReconcileBalances } from '@/lib/rust';
import { accountBalance } from '@/lib/transactions';

import type { ImportResult } from '../../supabase/functions/_shared/contracts';

/** "APOTEK K-24 KEMANG" -> "Apotek K-24 Kemang" agar enak dibaca di daftar transaksi. */
export function prettifyDescription(description: string): string {
  return description
    .trim()
    .slice(0, 120)
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bTrf\b/g, 'Transfer')
    .slice(0, 120);
}

export type StatementReconciliation = {
  closingBalance: number;
  projectedBalance: number;
  /** closingBalance - projectedBalance (> 0 = butuh pemasukan penyesuaian; < 0 = butuh pengeluaran penyesuaian; 0 = cocok). */
  difference: number;
  currency: string;
  asOfDate: string;
  matched: boolean;
};

/**
 * Bandingkan saldo akhir yang tercetak di PDF rekening koran dengan proyeksi saldo akun di Arshif
 * sampai tanggal penutupan rekening koran (setelah baris yang dicentang ditambahkan).
 */
export function reconcileStatement(
  result: Pick<ImportResult, 'closingBalance' | 'closingDate' | 'closingCurrency' | 'rows'>,
  selectedRows: ImportResult['rows'],
  account: Account | undefined,
  existing: Transaction[],
): StatementReconciliation | null {
  if (!account || result.closingBalance === null || result.closingBalance === undefined || !Number.isFinite(result.closingBalance)) {
    return null;
  }
  const statementCurrency = result.closingCurrency ?? account.currency;
  if (statementCurrency !== account.currency) return null;

  const maxRowDate = result.rows.reduce<string | null>((max, r) => (max === null || r.date > max ? r.date : max), null);
  const asOfDate = result.closingDate ?? maxRowDate ?? todayYmd();

  // Transaksi setelah tanggal akhir rekening koran tidak diikutkan pada posisi saldo per asOfDate.
  const existingAsOf = existing.filter((tx) => tx.date <= asOfDate);
  const baseBalance = accountBalance(account, existingAsOf);

  const deltas: number[] = [];
  let selectedDelta = 0;
  let allIntegerDeltas = Number.isInteger(baseBalance);
  for (const r of selectedRows) {
    if (r.date > asOfDate) continue;
    const amt = r.currency === account.currency ? r.amount : tryConvert(r.amount, r.currency, account.currency);
    if (amt === null || !Number.isFinite(amt)) return null;
    const signed = r.type === 'income' ? amt : -amt;
    deltas.push(signed);
    selectedDelta += signed;
    if (!Number.isInteger(signed)) allIntegerDeltas = false;
  }

  const closingBalance = Math.trunc(result.closingBalance);
  if (allIntegerDeltas) {
    const rustRes = rustReconcileBalances(baseBalance, closingBalance, deltas);
    if (rustRes.handled) {
      if (rustRes.value === null) return null;
      return {
        closingBalance,
        projectedBalance: rustRes.value.projectedBalance,
        difference: rustRes.value.difference,
        currency: account.currency,
        asOfDate,
        matched: rustRes.value.difference === 0,
      };
    }
  }

  const projectedBalance = Math.trunc(baseBalance + selectedDelta);
  const difference = closingBalance - projectedBalance;
  if (!Number.isSafeInteger(projectedBalance) || !Number.isSafeInteger(difference)) return null;

  return {
    closingBalance,
    projectedBalance,
    difference,
    currency: account.currency,
    asOfDate,
    matched: difference === 0,
  };
}

export function buildReconciliationTx(
  recon: StatementReconciliation,
  accountId: string,
  merchantLabel: string,
  id: string,
): Transaction | null {
  if (recon.difference === 0) return null;
  return {
    id,
    type: recon.difference > 0 ? 'income' : 'expense',
    merchant: merchantLabel,
    categoryKey: 'other',
    accountId,
    date: recon.asOfDate,
    time: '23:59',
    amount: Math.abs(recon.difference),
    currency: recon.currency,
    source: 'import',
  };
}
