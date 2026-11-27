import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Asset } from '@/data/assets';
import type { Account, Transaction } from '@/data/types';
import { todayYmd } from '@/lib/dates';
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

/**
 * Sel CSV. Teks yang diawali = + - @ tab atau CR dijalankan Excel/Sheets sebagai formula (CSV injection):
 * merchant berasal dari AI dan notifikasi bank, jadi diberi ' di depan agar tampil sebagai teks.
 * Angka murni (mis. nominal "-12.50") tidak diubah supaya tetap terbaca sebagai angka.
 */
export function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Ekspor data (FR-SET-3): semua akun + transaksi + aset milik pengguna yang sedang dimuat. */
export function buildExport(format: ExportFormat, accounts: Account[], transactions: Transaction[], assets: Asset[] = []): string {
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
        assets: assets.map((a) => ({
          ...a,
          buyPrice: a.buyPrice !== undefined ? decimal(a.buyPrice, a.currency) : undefined,
          valueOverride: a.valueOverride !== undefined ? decimal(a.valueOverride, a.currency) : undefined,
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
  const name = `arshif-${todayYmd()}.${format.toLowerCase()}`;
  const mime = format === 'JSON' ? 'application/json' : 'text/csv';
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    const timer = setTimeout(() => URL.revokeObjectURL(url), 10_000);
    (timer as unknown as { unref?: () => void })?.unref?.();
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(content);
  try {
    await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      /* abaikan gagal hapus cache */
    }
  }
}
