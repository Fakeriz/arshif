import type { Account, AppNotification, Plan, Transaction } from '@/data/types';
import type { Lang } from '@/i18n/types';
import type { Split } from '@/lib/budget';
import type { QuotaKey, Usage } from '@/lib/quota';
import { supabase } from '@/lib/supabase';
import type { AccentKey } from '@/theme/tokens';
import type { ThemeMode } from '@/theme/ThemeProvider';

import { fromTransaction, toAccount, toNotification, toTransaction, type AccountRow, type NotificationRow, type TransactionRow } from './mappers';

/** Gagal dari Supabase dijadikan Error biasa dengan kode PostgREST/Postgres bila ada. */
export class RemoteError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}
type Res<T> = { data: T | null; error: { message: string; code?: string } | null };
/** Untuk tulis tanpa hasil (update/delete). */
function check<T>(res: Res<T>): T | null {
  if (res.error) throw new RemoteError(res.error.message, res.error.code);
  return res.data;
}
/** Untuk baca: data wajib ada. */
function must<T>(res: Res<T>): T {
  const data = check(res);
  if (data === null) throw new RemoteError('empty_result');
  return data;
}

export type Profile = {
  email: string;
  displayName: string | null;
  mainCurrency: string;
  lang: Lang;
  accent: AccentKey;
  themeMode: ThemeMode;
  hideBalance: boolean;
  payday: number;
  income: number;
  split: Split;
  notifPrefs: Record<'bill_due' | 'budget_alert' | 'weekly_recap' | 'quota_warning', boolean>;
  activeAccountId: string | null;
  plan: Plan;
  onboarded: boolean;
};

type ProfileRow = {
  display_name: string | null; main_currency: string; lang: Lang; accent: AccentKey; theme_mode: ThemeMode; hide_balance: boolean;
  payday: number; monthly_income: number; split_needs: number; split_wants: number; split_savings: number;
  notif_prefs: Profile['notifPrefs']; active_account_id: string | null; plan: Plan; onboarded_at: string | null;
};

export async function loadProfile(userId: string, email: string): Promise<Profile> {
  const r = must(await supabase.from('profiles').select('*').eq('id', userId).single<ProfileRow>());
  return {
    email,
    displayName: r.display_name,
    mainCurrency: r.main_currency,
    lang: r.lang,
    accent: r.accent,
    themeMode: r.theme_mode,
    hideBalance: r.hide_balance,
    payday: r.payday,
    income: Number(r.monthly_income),
    split: { needs: r.split_needs, wants: r.split_wants, savings: r.split_savings },
    notifPrefs: r.notif_prefs,
    activeAccountId: r.active_account_id,
    plan: r.plan,
    onboarded: r.onboarded_at !== null,
  };
}

/** Kolom profil yang boleh diubah klien (sama dengan grant di migrasi). */
export type ProfilePatch = Partial<{
  display_name: string; main_currency: string; lang: Lang; accent: AccentKey; theme_mode: ThemeMode; hide_balance: boolean;
  payday: number; monthly_income: number; split_needs: number; split_wants: number; split_savings: number;
  notif_prefs: Profile['notifPrefs']; active_account_id: string | null; onboarded_at: string;
}>;

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<void> {
  check(await supabase.from('profiles').update(patch).eq('id', userId));
}

export async function loadAccounts(): Promise<Account[]> {
  const rows = must(await supabase.from('accounts').select('*').order('created_at').returns<AccountRow[]>());
  return rows.map(toAccount);
}

const PAGE = 1000;

/** Semua transaksi milik pengguna, dimuat per 1000 baris (urut terbaru). */
export async function loadTransactions(): Promise<Transaction[]> {
  const out: Transaction[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = must(
      await supabase
        .from('transactions')
        .select('*, transaction_items(name, qty, unit_price, total, position)')
        .order('date', { ascending: false })
        .order('time', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + PAGE - 1)
        .returns<TransactionRow[]>(),
    );
    out.push(...rows.map(toTransaction));
    if (rows.length < PAGE) return out;
  }
}

export async function loadNotifications(): Promise<AppNotification[]> {
  const rows = must(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50).returns<NotificationRow[]>());
  return rows.map(toNotification);
}

export async function loadUsage(): Promise<Usage> {
  const rows = must(await supabase.rpc('my_usage')) as unknown as { key: QuotaKey; used: number }[];
  const usage: Usage = { accounts: 0, scan: 0, automation: 0, importPdf: 0, invoice: 0 };
  for (const r of rows) usage[r.key] = r.used;
  return usage;
}

/** Kurs terbaru per mata uang (unit per 1 USD) + tanggalnya. */
export async function loadLatestRates(): Promise<{ table: Record<string, string>; date: string | null }> {
  return ratesOn(null);
}

/** Kurs pada (atau sebelum) tanggal transaksi: belanja memakai kurs pada harinya (FR-FX-4). */
export async function ratesOn(date: string | null): Promise<{ table: Record<string, string>; date: string | null }> {
  let q = supabase.from('fx_rates').select('rate_date, code, per_usd').order('rate_date', { ascending: false }).limit(400);
  if (date) q = q.lte('rate_date', date);
  const rows = must(await q.returns<{ rate_date: string; code: string; per_usd: string | number }[]>());
  const table: Record<string, string> = {};
  for (const r of rows) if (!(r.code in table)) table[r.code] = String(r.per_usd);
  return { table, date: rows[0]?.rate_date ?? null };
}

// ------------------------------------------------------------------ mutasi

export async function insertAccount(a: Omit<Account, 'id'>): Promise<Account> {
  const row = must(
    await supabase
      .from('accounts')
      .insert({ bank: a.bank, name: a.name, type: a.type, currency: a.currency, opening_balance: a.openingBalance, last4: a.last4 ?? null })
      .select('*')
      .single<AccountRow>(),
  );
  return toAccount(row);
}

export async function updateAccountBank(id: string, bank: string): Promise<void> {
  check(await supabase.from('accounts').update({ bank }).eq('id', id));
}

async function replaceItems(txs: Transaction[]): Promise<void> {
  const withItems = txs.filter((t) => t.items?.length);
  if (withItems.length === 0) return;
  check(await supabase.from('transaction_items').delete().in('transaction_id', withItems.map((t) => t.id)));
  check(
    await supabase.from('transaction_items').insert(
      withItems.flatMap((t) => t.items!.map((it, position) => ({ transaction_id: t.id, position, name: it.name, qty: it.qty, unit_price: it.unitPrice, total: it.total }))),
    ),
  );
}

/** Transaksi baru + item struk. id dibuat klien dan konflik diabaikan, jadi aman diulang. */
export async function insertTransactions(txs: Transaction[]): Promise<void> {
  if (txs.length === 0) return;
  check(await supabase.from('transactions').upsert(txs.map(fromTransaction), { onConflict: 'id', ignoreDuplicates: true }));
  await replaceItems(txs);
}

/** Ubah transaksi: sumber input dan foto struk tidak ikut diubah (tidak di-grant untuk update). */
export async function updateTransaction(t: Transaction): Promise<void> {
  const { id, source: _s, receipt_path: _r, ...patch } = fromTransaction(t);
  check(await supabase.from('transactions').update(patch).eq('id', id));
  await replaceItems([t]);
}

export async function deleteTransaction(id: string): Promise<void> {
  check(await supabase.from('transactions').delete().eq('id', id));
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  check(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids));
}

/** Signed URL 10 menit untuk foto struk (bucket privat, PRD Bab 9). */
export async function receiptUrl(path: string): Promise<string> {
  const data = must(await supabase.storage.from('receipts').createSignedUrl(path, 600));
  return data.signedUrl;
}
