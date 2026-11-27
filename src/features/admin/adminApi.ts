import { z } from 'zod';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/config/public';
import {
  must,
  type AdminDashboard,
  type AdminFxStatus,
  type AdminOrder,
  type AdminUserDetail,
  type AdminUserRow,
  type AiFailure,
  type AiUsageRow,
  type BroadcastSegment,
  type OrderStatus,
} from '@/data/remote/api';
import { invokeFn } from '@/data/remote/functions';
import { supabase } from '@/lib/supabase';

import { FUNCTIONS, HealthResponse } from '../../../supabase/functions/_shared/contracts';

export type {
  AdminDashboard,
  AdminFxStatus,
  AdminOrder,
  AdminUserDetail,
  AdminUserRow,
  AiFailure,
  AiUsageRow,
  BroadcastSegment,
  OrderStatus,
};

export type AdminAssetPriceRun = {
  ran_at: string;
  trigger: 'cron' | 'admin';
  ok: boolean;
  source: string;
  symbols: number;
  updated: number;
  failed_count: number;
  failed_sample: string[];
  error: string | null;
  duration_ms: number | null;
};

export type AdminRecentBroadcast = {
  sent_at: string;
  title: string;
  message: string;
  recipients: number;
};

export type AdminOpsOverview = {
  today: string;
  onboarded_users: number;
  dau_30: { day: string; users: number }[];
  currencies: Record<string, number>;
  langs: Record<string, number>;
  asset_runs: AdminAssetPriceRun[];
  webhooks_7d: Record<string, number>;
  stuck_orders: number;
  recent_broadcasts: AdminRecentBroadcast[];
};

export type SystemHealthProbe = {
  ok: boolean;
  status: 'ready' | 'live' | 'degraded' | 'unreachable';
  db?: 'ok' | 'error' | 'timeout';
  env?: 'ok' | 'missing';
  minClientVersion?: string;
  ts?: string;
  rttMs: number;
};

export type FxRateRow = {
  rate_date: string;
  code: string;
  per_usd: number;
  source: string;
  fetched_at: string;
};

export type LiveAssetPriceRow = {
  symbol: string;
  price: number;
  currency: string;
  source: string;
  fetched_at: string;
  quoted_at: string | null;
};

export const CORRIDOR_CURRENCIES = ['IDR', 'MYR', 'TRY', 'USD', 'SGD', 'SAR', 'EUR', 'GBP', 'JPY', 'AUD'] as const;

const AssetPricesSyncSchema = z.object({
  symbols: z.number(),
  updated: z.number(),
  failed: z.array(z.string()),
  providers: z.array(
    z.object({
      source: z.string(),
      symbols: z.number(),
      updated: z.number(),
      error: z.string().nullable(),
      ms: z.number().optional(),
    }),
  ),
});

export type AssetPricesSyncResult = z.infer<typeof AssetPricesSyncSchema>;

/**
 * Ringkasan operasional v2 (migrasi 35). Jika fungsi belum terpasang di server remote,
 * kembalikan null tanpa error supaya panel tetap berjalan mulus.
 */
export async function fetchAdminOpsOverview(): Promise<AdminOpsOverview | null> {
  try {
    const res = await supabase.rpc('admin_ops_overview');
    if (res.error || !res.data || typeof res.data !== 'object') return null;
    return res.data as AdminOpsOverview;
  } catch {
    return null;
  }
}

export async function searchAdminUsers(query: string, limit = 200): Promise<AdminUserRow[]> {
  return must(await supabase.rpc('admin_search_users', { p_query: query, p_limit: limit })) as AdminUserRow[];
}

export async function fetchAdminOrders(status: OrderStatus | null, limit = 300): Promise<AdminOrder[]> {
  return must(await supabase.rpc('admin_orders', { p_status: status, p_limit: limit })) as AdminOrder[];
}

export async function fetchAdminAiFailures(limit = 100): Promise<AiFailure[]> {
  return must(await supabase.rpc('admin_ai_failures', { p_limit: limit })) as AiFailure[];
}

/** Cek kesiapan Edge Function & koneksi DB secara langsung. Tidak pernah melempar error. */
export async function probeSystemHealth(): Promise<SystemHealthProbe> {
  const t0 = Date.now();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 6000) : null;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${FUNCTIONS.health}?check=ready`, {
      method: 'GET',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      signal: controller?.signal,
    });
    const rttMs = Date.now() - t0;
    const raw = await res.json().catch(() => null);
    const parsed = HealthResponse.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, status: res.ok ? 'degraded' : 'unreachable', rttMs };
    }
    return {
      ok: parsed.data.ok,
      status: parsed.data.status,
      db: parsed.data.db,
      env: parsed.data.env,
      minClientVersion: parsed.data.minClientVersion,
      ts: parsed.data.ts,
      rttMs,
    };
  } catch {
    return { ok: false, status: 'unreachable', rttMs: Date.now() - t0 };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Baca kurs aktif pada tanggal terbaru dengan mata uang koridor utama Arshif di urutan teratas. */
export async function fetchLatestFxRates(latestDate: string | null): Promise<FxRateRow[]> {
  if (!latestDate) return [];
  try {
    const { data, error } = await supabase
      .from('fx_rates')
      .select('rate_date, code, per_usd, source, fetched_at')
      .eq('rate_date', latestDate);
    if (error || !data) return [];
    const pinned = new Map<string, number>(CORRIDOR_CURRENCIES.map((c, idx) => [c, idx]));
    return (data as { rate_date: string; code: string; per_usd: string | number; source: string; fetched_at: string }[])
      .map((r) => ({
        rate_date: r.rate_date,
        code: r.code,
        per_usd: Number(r.per_usd),
        source: r.source,
        fetched_at: r.fetched_at,
      }))
      .sort((a, b) => {
        const pa = pinned.get(a.code);
        const pb = pinned.get(b.code);
        if (pa !== undefined && pb !== undefined) return pa - pb;
        if (pa !== undefined) return -1;
        if (pb !== undefined) return 1;
        return a.code.localeCompare(b.code);
      });
  } catch {
    return [];
  }
}

export async function fetchLiveAssetPrices(): Promise<LiveAssetPriceRow[]> {
  try {
    const { data, error } = await supabase
      .from('asset_prices')
      .select('symbol, price, currency, source, fetched_at, quoted_at')
      .order('symbol', { ascending: true })
      .limit(200);
    if (error || !data) return [];
    return (data as { symbol: string; price: string | number; currency: string; source: string; fetched_at: string; quoted_at: string | null }[]).map((r) => ({
      symbol: r.symbol,
      price: Number(r.price),
      currency: r.currency,
      source: r.source,
      fetched_at: r.fetched_at,
      quoted_at: r.quoted_at ?? null,
    }));
  } catch {
    return [];
  }
}

export async function triggerAssetPricesSync(): Promise<AssetPricesSyncResult> {
  return invokeFn('asset-prices-sync', {}, AssetPricesSyncSchema);
}

function escapeCsvCell(cell: string | number | null | undefined): string {
  if (cell === null || cell === undefined) return '';
  const text = String(cell);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))];
  return `\uFEFF${lines.join('\r\n')}`;
}

/** Unduh berkas CSV ber-BOM UTF-8 di browser web. Aman dipanggil di lingkungan tes/non-DOM. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]): boolean {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return false;
  }
  try {
    const csv = buildCsv(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback textarea di bawah.
  }
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return false;
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
