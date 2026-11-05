import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Account, Transaction } from '@/data/types';
import { currencyMeta } from '@/lib/money';

export type ExportFormat = 'JSON' | 'CSV';

/** Nominal unit terkecil → teks desimal dengan titik (mis. 1250 MYR → "12.50"), tanpa float. */
function decimal(minor: number, code: string): string {
  const exp = currencyMeta(code).exponent;
  const neg = minor < 0;
  const digits = String(Math.abs(minor)).padStart(exp + 1, '0');
  const body = exp === 0 ? digits : `${digits.slice(0, -exp)}.${digits.slice(-exp)}`;
  return neg ? `-${body}` : body;
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Ekspor data (FR-SET-3): semua akun + transaksi milik pengguna yang sedang dimuat. */
export function buildExport(format: ExportFormat, accounts: Account[], transactions: Transaction[]): string {
  const accName = new Map(accounts.map((a) => [a.id, a.name]));
  if (format === 'JSON') {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        accounts: accounts.map((a) => ({ ...a, openingBalance: decimal(a.openingBalance, a.currency) })),
        transactions: transactions.map((t) => ({
          ...t,
          amount: decimal(t.amount, t.currency),
          items: t.items?.map((i) => ({ ...i, unitPrice: decimal(i.unitPrice, t.currency), total: decimal(i.total, t.currency) })),
        })),
      },
      null,
      2,
    );
  }
  const head = ['date', 'time', 'type', 'merchant', 'category', 'account', 'to_account', 'amount', 'currency', 'source', 'note'];
  const rows = transactions.map((t) =>
    [t.date, t.time, t.type, t.merchant, t.categoryKey, accName.get(t.accountId) ?? '', t.toAccountId ? (accName.get(t.toAccountId) ?? '') : '', decimal(t.amount, t.currency), t.currency, t.source, t.note ?? '']
      .map(csvCell)
      .join(','),
  );
  return [head.join(','), ...rows].join('\n');
}

/** Web: unduh berkas. Native: simpan ke cache lalu buka lembar bagikan sistem. */
export async function saveExport(format: ExportFormat, content: string): Promise<void> {
  const name = `arshif-${new Date().toISOString().slice(0, 10)}.${format.toLowerCase()}`;
  const mime = format === 'JSON' ? 'application/json' : 'text/csv';
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
}
