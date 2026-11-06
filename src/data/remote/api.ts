import type { Account, AppNotification, BudgetRecord, LimitGroup, Plan, Transaction } from '@/data/types';
import type { RateRow, UserRate } from '@/lib/fx';
import type { Lang } from '@/i18n/types';
import type { Split } from '@/lib/budget';
import { EMPTY_USAGE, isQuotaKey, type Usage } from '@/lib/quota';
import { supabase } from '@/lib/supabase';
import type { AccentKey } from '@/theme/tokens';
import type { ThemeMode } from '@/theme/ThemeProvider';

import {
  creditColumns, fromTransaction, toAccount, toBudget, toLimitGroup, toNotification, toTransaction,
  type AccountRow, type BudgetRow, type LimitGroupRow, type NotificationRow, type TransactionRow,
} from './mappers';

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
  premiumUntil: string | null;
  premiumSource: 'store' | 'web' | 'manual' | null;
  onboarded: boolean;
};

type ProfileRow = {
  display_name: string | null; main_currency: string; lang: Lang; accent: AccentKey; theme_mode: ThemeMode; hide_balance: boolean;
  payday: number; monthly_income: number; split_needs: number; split_wants: number; split_savings: number;
  notif_prefs: Profile['notifPrefs']; active_account_id: string | null; plan: Plan; onboarded_at: string | null;
  premium_until: string | null; premium_source: 'store' | 'web' | 'manual' | null;
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
    premiumUntil: r.premium_until,
    premiumSource: r.premium_source,
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
        .select('*, transaction_items(name, qty, unit_price, total, position, discount, tax_rate)')
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
  const rows = must(await supabase.rpc('my_usage')) as unknown as { key: string; used: number }[];
  const usage: Usage = { ...EMPTY_USAGE };
  for (const r of rows) if (isQuotaKey(r.key)) usage[r.key] = r.used;
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

/**
 * Riwayat kurs harian untuk kode yang dipakai pengguna sejak `since` (FR-FX-4: transaksi lama tetap memakai
 * kurs harinya). Diambil per 1000 baris.
 */
export async function loadRateHistory(codes: string[], since: string): Promise<RateRow[]> {
  const list = codes.filter((c) => c !== 'USD');
  if (list.length === 0) return [];
  const out: RateRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = must(
      await supabase
        .from('fx_rates')
        .select('rate_date, code, per_usd')
        .in('code', list)
        .gte('rate_date', since)
        .order('rate_date')
        .order('code')
        .range(from, from + PAGE - 1)
        .returns<{ rate_date: string; code: string; per_usd: string | number }[]>(),
    );
    out.push(...rows.map((r) => ({ date: r.rate_date, code: r.code, perUsd: String(r.per_usd) })));
    if (rows.length < PAGE) return out;
  }
}

// ------------------------------------------------------------------ Fase 7: anggaran, grup limit, kurs saya

export async function loadBudgets(): Promise<BudgetRecord[]> {
  const rows = must(await supabase.from('budgets').select('id, period_start, total, category_limits').order('period_start', { ascending: false }).limit(24).returns<BudgetRow[]>());
  return rows.map(toBudget);
}

/**
 * Simpan anggaran satu periode. Update dulu lalu insert: upsert PostgREST ikut menulis id/period_start, padahal
 * hak update hanya untuk total dan category_limits.
 */
export async function saveBudget(b: BudgetRecord): Promise<void> {
  const updated = check(
    await supabase.from('budgets').update({ total: b.total, category_limits: b.categoryLimits }).eq('period_start', b.periodStart).select('id'),
  ) as { id: string }[] | null;
  if (updated?.length) return;
  check(await supabase.from('budgets').insert({ id: b.id, period_start: b.periodStart, total: b.total, category_limits: b.categoryLimits }));
}

export async function loadLimitGroups(): Promise<LimitGroup[]> {
  const rows = must(await supabase.from('limit_groups').select('id, name, currency, shared_limit').order('created_at').returns<LimitGroupRow[]>());
  return rows.map(toLimitGroup);
}

export async function insertLimitGroup(g: LimitGroup): Promise<void> {
  check(await supabase.from('limit_groups').insert({ id: g.id, name: g.name, currency: g.currency, shared_limit: g.sharedLimit }));
}

export async function updateLimitGroup(g: LimitGroup): Promise<void> {
  check(await supabase.from('limit_groups').update({ name: g.name, currency: g.currency, shared_limit: g.sharedLimit }).eq('id', g.id));
}

export async function deleteLimitGroup(id: string): Promise<void> {
  check(await supabase.from('limit_groups').delete().eq('id', id));
}

/** Limit, grup, dan iuran tahunan kartu. */
export async function updateAccountCredit(id: string, a: Pick<Account, 'creditLimit' | 'limitGroupId' | 'annualFee'>): Promise<void> {
  check(await supabase.from('accounts').update(creditColumns(a)).eq('id', id));
}

export async function loadUserRates(): Promise<UserRate[]> {
  const rows = must(await supabase.from('user_rates').select('code, base, rate').returns<{ code: string; base: string; rate: string | number }[]>());
  return rows.map((r) => ({ code: r.code, base: r.base, rate: String(r.rate) }));
}

/** Update dulu lalu insert (kode tidak punya hak update). */
export async function saveUserRate(r: UserRate): Promise<void> {
  const updated = check(await supabase.from('user_rates').update({ base: r.base, rate: r.rate }).eq('code', r.code).select('code')) as { code: string }[] | null;
  if (updated?.length) return;
  check(await supabase.from('user_rates').insert({ code: r.code, base: r.base, rate: r.rate }));
}

export async function deleteUserRate(code: string): Promise<void> {
  check(await supabase.from('user_rates').delete().eq('code', code));
}

// ------------------------------------------------------------------ mutasi

export async function insertAccount(a: Omit<Account, 'id'>): Promise<Account> {
  const row = must(
    await supabase
      .from('accounts')
      .insert({ bank: a.bank, name: a.name, type: a.type, currency: a.currency, opening_balance: a.openingBalance, last4: a.last4 ?? null, ...creditColumns(a) })
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
      withItems.flatMap((t) =>
        t.items!.map((it, position) => ({ transaction_id: t.id, position, name: it.name, qty: it.qty, unit_price: it.unitPrice, total: it.total, discount: Math.min(it.discount ?? 0, it.total), tax_rate: it.taxRate ?? null })),
      ),
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

/** Status reimbursement + tautan pemasukan pengganti. Server menormalkan status dari tautan. */
export async function setReimbursement(id: string, status: 'pending' | 'reimbursed' | null, reimbursedBy: string | null): Promise<void> {
  check(await supabase.from('transactions').update({ reimburse_status: status, reimbursed_by: reimbursedBy }).eq('id', id));
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

// ------------------------------------------------------------------ billing (Fase 3)
export type OrderStatus = 'pending' | 'paid' | 'expired' | 'failed' | 'refunded';
export type Order = {
  id: string;
  provider: 'xendit' | 'paddle' | 'manual';
  period: 'monthly' | 'yearly' | 'custom';
  currency: string;
  amount: number;
  method: string | null;
  status: OrderStatus;
  checkoutUrl: string | null;
  /** ID di penyedia: invoice Xendit atau transaksi Paddle (untuk membuka ulang checkout Paddle). */
  providerRef: string | null;
  expiresAt: string;
  paidAt: string | null;
  grantedUntil: string | null;
  createdAt: string;
};

type OrderRow = {
  id: string; provider: Order['provider']; period: Order['period']; currency: string; amount: number | string; method: string | null;
  status: OrderStatus; checkout_url: string | null; provider_ref: string | null; expires_at: string; paid_at: string | null; granted_until: string | null; created_at: string;
};

export function mapOrder(r: OrderRow): Order {
  return {
    id: r.id, provider: r.provider, period: r.period, currency: r.currency, amount: Number(r.amount), method: r.method, status: r.status,
    checkoutUrl: r.checkout_url, providerRef: r.provider_ref, expiresAt: r.expires_at, paidAt: r.paid_at, grantedUntil: r.granted_until, createdAt: r.created_at,
  };
}

export async function loadOrder(id: string): Promise<Order | null> {
  // Kolom eksplisit: klien hanya punya hak baca pada kolom ini (bukan granted_by/grant_error).
  const r = must(await supabase.from('orders').select('id, provider, period, currency, amount, method, status, checkout_url, provider_ref, expires_at, paid_at, granted_until, created_at').eq('id', id).maybeSingle<OrderRow>());
  return r ? mapOrder(r) : null;
}

export async function isAdmin(): Promise<boolean> {
  return Boolean(must(await supabase.rpc('is_admin')));
}

export type AdminOrder = {
  id: string; user_id: string; email: string; provider: string; period: string; currency: string; amount: number; method: string | null;
  status: OrderStatus; created_at: string; paid_at: string | null; granted_until: string | null; grant_error: string | null;
};
export async function adminOrders(status: OrderStatus | null): Promise<AdminOrder[]> {
  return must(await supabase.rpc('admin_orders', { p_status: status, p_limit: 200 })) as AdminOrder[];
}

export type AiUsageRow = { kind: string; total: number; ok: number; failed: number; limited: number; fail_ratio: number | null; avg_latency_ms: number | null; p95_latency_ms: number | null };
export async function adminAiUsage(days: number): Promise<AiUsageRow[]> {
  return must(await supabase.rpc('admin_ai_usage', { p_days: days })) as AiUsageRow[];
}

export type AiFailure = { created_at: string; kind: string; email: string; error: string | null; latency_ms: number | null };
export async function adminAiFailures(): Promise<AiFailure[]> {
  return must(await supabase.rpc('admin_ai_failures', { p_limit: 50 })) as AiFailure[];
}
