import type { Asset, AssetAlert, AssetPrice, AssetType, NetWorthSnapshot, PricePoint } from '@/data/assets';
import { supabase } from '@/lib/supabase';

import { RemoteError } from './api';
import { QuotaError } from './planning';
import { newId } from '@/lib/uuid';

type Res<T> = { data: T | null; error: { message: string; code?: string } | null };
function check<T>(res: Res<T>): T | null {
  if (res.error) {
    if (/quota_assets/.test(res.error.message)) throw new QuotaError('assets');
    throw new RemoteError(res.error.message, res.error.code);
  }
  return res.data;
}
function must<T>(res: Res<T>): T {
  const data = check(res);
  if (data === null) throw new RemoteError('empty_result');
  return data;
}

const opt = <T,>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);
const optNum = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));

type AssetRow = {
  id: string; type: AssetType; symbol: string | null; name: string; quantity: string | number | null; buy_price: number | null; currency: string;
  buy_date: string | null; value_override: number | null; notes: string | null; price_key: string | null; created_at: string;
};
type PriceRow = { symbol: string; price: string | number; currency: string; fetched_at: string; quoted_at?: string | null };
type SnapshotRow = { date: string; total: number; assets_total: number; liabilities_total: number; currency: string };

export const toAsset = (r: AssetRow): Asset => ({
  id: r.id, type: r.type, symbol: opt(r.symbol), name: r.name, quantity: optNum(r.quantity), buyPrice: optNum(r.buy_price), currency: r.currency,
  buyDate: opt(r.buy_date), valueOverride: optNum(r.value_override), notes: opt(r.notes), priceKey: opt(r.price_key), createdAt: r.created_at,
});
const toPrice = (r: PriceRow): AssetPrice => ({ symbol: r.symbol, price: Number(r.price), currency: r.currency, fetchedAt: r.fetched_at, quotedAt: opt(r.quoted_at) });
const toSnapshot = (r: SnapshotRow): NetWorthSnapshot => ({
  date: r.date, total: Number(r.total), assetsTotal: Number(r.assets_total), liabilitiesTotal: Number(r.liabilities_total), currency: r.currency,
});

/** `alerts` dan `history` opsional: data tetap (tes) dan server sebelum migrasi 24 tidak punya keduanya. */
export type AssetsData = {
  assets: Asset[];
  prices: Record<string, AssetPrice>;
  snapshots: NetWorthSnapshot[];
  alerts?: AssetAlert[];
  history?: Record<string, PricePoint[]>;
};

type AlertRow = { id: string; asset_id: string; pct: string | number; base_price: string | number; currency: string; triggered_at: string | null };
const toAlert = (r: AlertRow): AssetAlert => ({
  id: r.id, assetId: r.asset_id, pct: Number(r.pct), basePrice: Number(r.base_price), currency: r.currency, triggeredAt: opt(r.triggered_at),
});

/** Alert harga milik pengguna. Gagal (mis. tabel belum ada) = tanpa alert, bukan gagal memuat seluruh tab Aset. */
export async function loadAlerts(): Promise<AssetAlert[]> {
  const res = await supabase.from('asset_price_alerts').select('id, asset_id, pct, base_price, currency, triggered_at').returns<AlertRow[]>();
  return res.error ? [] : (res.data ?? []).map(toAlert);
}

/** Pasang alert (atau pasang lagi dengan ambang baru). Patokan harga selalu diisi server dari harga terakhir. */
export async function saveAlert(assetId: string, pct: number, existingId?: string): Promise<AssetAlert> {
  const cols = 'id, asset_id, pct, base_price, currency, triggered_at';
  const res = existingId
    ? await supabase.from('asset_price_alerts').update({ pct }).eq('id', existingId).select(cols).single<AlertRow>()
    : await supabase.from('asset_price_alerts').insert({ id: newId(), asset_id: assetId, pct }).select(cols).single<AlertRow>();
  return toAlert(must(res));
}

export async function deleteAlert(id: string): Promise<void> {
  check(await supabase.from('asset_price_alerts').delete().eq('id', id));
}

/** Harga harian sejak `since` untuk kunci yang dipakai. Gagal = kosong (Replay hanya tidak menampilkan penggerak). */
export async function loadPriceHistory(keys: string[], since: string): Promise<Record<string, PricePoint[]>> {
  if (keys.length === 0) return {};
  const res = await supabase
    .from('asset_price_history')
    .select('symbol, day, price, currency')
    .in('symbol', keys)
    .gte('day', since)
    .order('day')
    .returns<{ symbol: string; day: string; price: string | number; currency: string }[]>();
  const out: Record<string, PricePoint[]> = {};
  for (const r of res.error ? [] : (res.data ?? [])) (out[r.symbol] ??= []).push({ day: r.day, price: Number(r.price), currency: r.currency });
  return out;
}

/** Aset milik pengguna, harga untuk kunci yang dipakai, dan snapshot setahun terakhir. */
export async function loadAssets(sinceYmd: string): Promise<AssetsData> {
  const [assets, snapshots] = await Promise.all([
    supabase.from('assets').select('*').order('created_at').returns<AssetRow[]>(),
    supabase.from('net_worth_snapshots').select('date, total, assets_total, liabilities_total, currency').gte('date', sinceYmd).order('date').returns<SnapshotRow[]>(),
  ]);
  const list = must(assets).map(toAsset);
  const keys = [...new Set(list.map((a) => a.priceKey).filter((k): k is string => !!k))];
  const weekAgo = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
  const [prices, alerts, history] = await Promise.all([loadPrices(list), loadAlerts(), loadPriceHistory(keys, weekAgo)]);
  return { assets: list, prices, snapshots: must(snapshots).map(toSnapshot), alerts, history };
}

export async function loadPrices(assets: Asset[]): Promise<Record<string, AssetPrice>> {
  const keys = [...new Set(assets.map((a) => a.priceKey).filter((k): k is string => !!k))];
  if (keys.length === 0) return {};
  // `*` bukan daftar kolom: aplikasi tetap jalan saat kolom baru (quoted_at, migrasi 23) belum ada di server.
  const rows = must(await supabase.from('asset_prices').select('*').in('symbol', keys).returns<PriceRow[]>());
  return Object.fromEntries(rows.map((r) => [r.symbol, toPrice(r)]));
}

export type AssetInput = Pick<Asset, 'symbol' | 'name' | 'quantity' | 'buyPrice' | 'currency' | 'buyDate' | 'valueOverride' | 'notes'>;
const cols = (a: AssetInput) => ({
  symbol: a.symbol ?? null, name: a.name, quantity: a.quantity ?? null, buy_price: a.buyPrice ?? null, currency: a.currency,
  buy_date: a.buyDate ?? null, value_override: a.valueOverride ?? null, notes: a.notes ?? null,
});

export async function insertAsset(id: string, type: AssetType, a: AssetInput): Promise<Asset> {
  return toAsset(must(await supabase.from('assets').insert({ id, type, ...cols(a) }).select('*').single<AssetRow>()));
}
export async function updateAsset(id: string, a: AssetInput): Promise<Asset> {
  return toAsset(must(await supabase.from('assets').update(cols(a)).eq('id', id).select('*').single<AssetRow>()));
}
export async function deleteAsset(id: string): Promise<void> {
  check(await supabase.from('assets').delete().eq('id', id));
}

/** Maksimal satu snapshot per hari: snapshot hari ini ditimpa angka terbaru. */
export async function saveSnapshot(s: NetWorthSnapshot): Promise<void> {
  check(
    await supabase
      .from('net_worth_snapshots')
      .upsert({ date: s.date, total: s.total, assets_total: s.assetsTotal, liabilities_total: s.liabilitiesTotal, currency: s.currency }, { onConflict: 'user_id,date' }),
  );
}
