import type { Transaction } from '@/data/types';
import type { Capture, Doubt, Parsed } from '@/lib/smartlog/parser';
import { supabase } from '@/lib/supabase';

import { RemoteError } from './api';

/** Alasan masuk To Review: keraguan parser + pemeriksaan server (migrasi smartlog). */
export type ReviewReason = Doubt | 'not_expense' | 'not_idr' | 'no_link' | 'account_currency' | 'duplicate';

export type SmartLogStatus = 'review' | 'applied' | 'confirmed' | 'dismissed' | 'undone';

export type SmartLogItem = {
  id: string;
  pkg: string;
  bank: string;
  date: string;
  time: string;
  type: 'expense' | 'income';
  amount: number;
  currency: string;
  merchant: string;
  accountId: string | null;
  status: SmartLogStatus;
  reasons: ReviewReason[];
  excerpt: string | null;
  createdAt: string;
};

export type SmartLogLink = { pkg: string; accountId: string };

/** disabled = automation OFF di server, quota = kuota automation habis (notifikasi tidak diproses). */
export type IngestResult =
  | { status: 'disabled' | 'quota' }
  | { status: SmartLogStatus; id: string; reasons: ReviewReason[]; repeat?: boolean };

type ItemRow = {
  id: string; package: string; bank: string; date: string; time: string; type: 'expense' | 'income'; amount: number;
  currency: string; merchant: string; account_id: string | null; status: SmartLogStatus; reasons: ReviewReason[];
  excerpt: string | null; created_at: string;
};

const toItem = (r: ItemRow): SmartLogItem => ({
  id: r.id, pkg: r.package, bank: r.bank, date: r.date, time: r.time.slice(0, 5), type: r.type, amount: Number(r.amount),
  currency: r.currency, merchant: r.merchant, accountId: r.account_id, status: r.status, reasons: r.reasons ?? [],
  excerpt: r.excerpt, createdAt: r.created_at,
});

function fail(error: { message: string; code?: string } | null): void {
  if (error) throw new RemoteError(error.message, error.code);
}

export type SmartLogData = { enabled: boolean; links: SmartLogLink[]; review: SmartLogItem[]; recent: SmartLogItem[] };

/** Saklar, tautan, antrean To Review, dan yang auto-apply 7 hari terakhir (untuk Undo/Edit). */
export async function loadSmartLog(userId: string): Promise<SmartLogData> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [profile, links, items] = await Promise.all([
    supabase.from('profiles').select('smartlog_enabled').eq('id', userId).single<{ smartlog_enabled: boolean }>(),
    supabase.from('smartlog_links').select('package, account_id').order('created_at').returns<{ package: string; account_id: string }[]>(),
    supabase
      .from('smartlog_items')
      .select('id, package, bank, date, time, type, amount, currency, merchant, account_id, status, reasons, excerpt, created_at')
      .or(`status.eq.review,and(status.eq.applied,created_at.gte.${since})`)
      .order('created_at', { ascending: false })
      .limit(200)
      .returns<ItemRow[]>(),
  ]);
  fail(profile.error);
  fail(links.error);
  fail(items.error);
  const all = (items.data ?? []).map(toItem);
  return {
    enabled: profile.data?.smartlog_enabled ?? false,
    links: (links.data ?? []).map((l) => ({ pkg: l.package, accountId: l.account_id })),
    review: all.filter((i) => i.status === 'review'),
    recent: all.filter((i) => i.status === 'applied'),
  };
}

export async function setEnabled(userId: string, enabled: boolean): Promise<void> {
  fail((await supabase.from('profiles').update({ smartlog_enabled: enabled }).eq('id', userId)).error);
}

export async function setLink(pkg: string, accountId: string): Promise<void> {
  fail((await supabase.from('smartlog_links').upsert({ package: pkg, account_id: accountId }, { onConflict: 'user_id,package' })).error);
}

export async function removeLink(pkg: string): Promise<void> {
  fail((await supabase.from('smartlog_links').delete().eq('package', pkg)).error);
}

/** Kirim satu notifikasi yang lolos parser. Tanggal dan jam = waktu notifikasi diterima (jam lokal perangkat). */
export async function ingest(c: Capture, p: Parsed, date: string, time: string): Promise<IngestResult> {
  const { data, error } = await supabase.rpc('smartlog_ingest', {
    p_capture_key: c.key, p_package: c.pkg, p_bank: p.bank, p_posted_at: new Date(c.postedAt).toISOString(), p_date: date, p_time: time,
    p_type: p.type, p_amount: p.amount, p_currency: p.currency, p_merchant: p.merchant, p_excerpt: p.excerpt,
    p_fingerprint: p.fingerprint, p_doubts: p.doubts,
  });
  fail(error);
  return data as IngestResult;
}

export async function confirm(id: string): Promise<void> {
  fail((await supabase.rpc('smartlog_confirm', { p_item: id })).error);
}

export async function dismiss(id: string): Promise<void> {
  fail((await supabase.rpc('smartlog_dismiss', { p_item: id })).error);
}

export async function undo(id: string): Promise<void> {
  fail((await supabase.rpc('smartlog_undo', { p_item: id })).error);
}

/** Transaksi yang dibuat server saat auto-apply, untuk ditambahkan ke store tanpa memuat ulang semua data. */
export function appliedTx(item: Pick<SmartLogItem, 'id' | 'merchant' | 'accountId' | 'date' | 'time' | 'amount' | 'currency'>): Transaction {
  return {
    id: item.id, type: 'expense', merchant: item.merchant, categoryKey: 'other', accountId: item.accountId ?? '', date: item.date,
    time: item.time, amount: item.amount, currency: item.currency, source: 'smartlog',
  };
}
