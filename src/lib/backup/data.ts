import { z } from 'zod';

import { toBase64 } from '@/data/remote/upload';
import { receiptUrl } from '@/data/remote/api';
import { fromBase64 } from '@/lib/base64';
import { supabase } from '@/lib/supabase';

/**
 * Tabel data pengguna yang ikut cadangan, urut sesuai ketergantungan (akun sebelum transaksi, transaksi sebelum item, ...).
 * Tidak ikut: paket/kuota/pesanan (tidak boleh dipulihkan dari file), notifikasi, cache Coach, tautan Smart Log (per HP).
 */
export const BACKUP_TABLES = [
  'limit_groups', 'accounts', 'smartlog_rules', 'user_rates', 'transactions', 'transaction_items', 'budgets',
  'goals', 'goal_deposits', 'split_bills', 'debts', 'debt_payments', 'bills', 'subscriptions',
  'invoices', 'assets', 'asset_price_alerts', 'net_worth_snapshots',
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

const TABLE_ORDER: Record<BackupTable, string> = {
  limit_groups: 'id', accounts: 'id', smartlog_rules: 'id', user_rates: 'code', transactions: 'id', transaction_items: 'id',
  budgets: 'period_start', goals: 'id', goal_deposits: 'id', split_bills: 'id', debts: 'id',
  debt_payments: 'id', bills: 'id', subscriptions: 'id', invoices: 'id', assets: 'id',
  asset_price_alerts: 'id', net_worth_snapshots: 'date',
};

/** Kolom profil yang dipulihkan: preferensi saja (sama dengan kolom yang boleh diubah aplikasi). */
const PROFILE_FIELDS = ['display_name', 'main_currency', 'lang', 'theme_mode', 'hide_balance', 'include_assets', 'payday', 'monthly_income', 'split_needs', 'split_wants', 'split_savings', 'notif_prefs', 'categories'] as const;

const PAGE = 1000;
const CHUNK = 200;

export type BackupPayload = {
  v: 1;
  profile: Record<string, unknown>;
  tables: Partial<Record<BackupTable, Record<string, unknown>[]>>;
  /** path struk asli -> isi berkas base64 (kosong bila foto struk tidak ikut). */
  receipts: Record<string, string>;
};

type Progress = (done: number, total: number) => void;

async function allRows(table: BackupTable): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const orderCol = TABLE_ORDER[table];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').order(orderCol, { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    // user_id tidak ikut: saat dipulihkan selalu milik akun yang sedang masuk.
    rows.push(...(data as Record<string, unknown>[]).map(({ user_id: _u, ...r }) => r));
    if (data.length < PAGE) return rows;
  }
}

/** Kumpulkan semua data akun (+ struk bila diminta) jadi satu objek. */
export async function collectBackup(userId: string, withReceipts: boolean, onProgress?: Progress): Promise<BackupPayload> {
  const tables: BackupPayload['tables'] = {};
  for (const [i, t] of BACKUP_TABLES.entries()) {
    tables[t] = await allRows(t);
    onProgress?.(i + 1, BACKUP_TABLES.length);
  }
  const { data: profile, error } = await supabase.from('profiles').select(PROFILE_FIELDS.join(', ')).eq('id', userId).single();
  if (error) throw error;

  const receipts: Record<string, string> = {};
  if (withReceipts) {
    const paths = [...new Set((tables.transactions ?? []).map((r) => r.receipt_path).filter((p): p is string => typeof p === 'string' && p.length > 0))];
    for (const [i, path] of paths.entries()) {
      // Struk yang hilang di storage dilewati: cadangan tetap jadi, transaksinya tetap ada.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const controller = new AbortController();
        timer = setTimeout(() => controller.abort(), 15_000);
        const res = await fetch(await receiptUrl(path), { signal: controller.signal });
        if (res.ok) receipts[path] = toBase64(await res.arrayBuffer());
      } catch {
        /* lewati */
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
      onProgress?.(i + 1, paths.length);
    }
  }
  return { v: 1, profile: profile as unknown as Record<string, unknown>, tables, receipts };
}

/** Isi file setelah didekripsi: data pengguna, jadi bentuknya diperiksa dulu. */
const Payload = z.object({
  v: z.literal(1),
  profile: z.record(z.string(), z.unknown()),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
  receipts: z.record(z.string(), z.string()),
});

export function parsePayload(json: string): BackupPayload | null {
  try {
    const r = Payload.safeParse(JSON.parse(json));
    return r.success ? (r.data as BackupPayload) : null;
  } catch {
    return null;
  }
}

export type RestoreReport = { restored: number; skipped: number; byTable: Partial<Record<BackupTable, { restored: number; skipped: number }>>; receipts: number };

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf' };

/**
 * Gabungkan cadangan ke akun yang sedang masuk. Baris dipulihkan lewat fungsi database restore_rows (hak pengguna sendiri:
 * RLS, trigger kepemilikan, dan kuota paket tetap berlaku); baris yang gagal dilewati dan dihitung, bukan membatalkan semuanya.
 */
export async function restoreBackup(userId: string, p: BackupPayload, onProgress?: Progress): Promise<RestoreReport> {
  // Struk diunggah ke folder pengguna ini (cadangan dari akun lain memakai folder lain), lalu path transaksi disesuaikan.
  const moved = new Map<string, string>();
  for (const [path, b64] of Object.entries(p.receipts)) {
    const name = path.split('/').pop() ?? '';
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (!/^[\w-]+\.\w+$/.test(name) || !MIME[ext]) continue;
    const target = `${userId}/${name}`;
    const { error } = await supabase.storage.from('receipts').upload(target, fromBase64(b64), { contentType: MIME[ext], upsert: true });
    if (!error) moved.set(path, target);
  }
  const fixPath = (r: Record<string, unknown>) => {
    const path = r.receipt_path;
    if (typeof path !== 'string') return r;
    // Struk yang tidak ikut/tidak bisa diunggah: path dikosongkan supaya transaksi tidak menunjuk berkas yang tidak ada.
    return { ...r, receipt_path: moved.get(path) ?? (path.startsWith(`${userId}/`) ? path : null) };
  };

  const report: RestoreReport = { restored: 0, skipped: 0, byTable: {}, receipts: moved.size };
  for (const [i, t] of BACKUP_TABLES.entries()) {
    const rawRows = (p.tables[t] ?? []).map(({ user_id: _u, ...r }) => (t === 'transactions' ? fixPath(r) : r));
    // Transaksi pemasukan (tanpa reimbursed_by) dipulihkan lebih dulu sebelum pengeluaran yang menautkannya.
    const rows =
      t === 'transactions'
        ? [...rawRows].sort((a, b) => Number(Boolean(a.reimbursed_by)) - Number(Boolean(b.reimbursed_by)))
        : rawRows;
    const sum = { restored: 0, skipped: 0 };
    for (let from = 0; from < rows.length; from += CHUNK) {
      const { data, error } = await supabase.rpc('restore_rows', { p_table: t, p_rows: rows.slice(from, from + CHUNK) });
      if (error) throw error;
      const r = data as { restored: number; skipped: number };
      sum.restored += r.restored;
      sum.skipped += r.skipped;
    }
    report.byTable[t] = sum;
    report.restored += sum.restored;
    report.skipped += sum.skipped;
    onProgress?.(i + 1, BACKUP_TABLES.length);
  }

  const profile = Object.fromEntries(PROFILE_FIELDS.filter((k) => k in p.profile).map((k) => [k, p.profile[k]]));
  if (Object.keys(profile).length) {
    const { error } = await supabase.from('profiles').update(profile).eq('id', userId);
    if (error) throw error;
  }
  return report;
}

