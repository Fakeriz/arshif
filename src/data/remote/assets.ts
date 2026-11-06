import type { Asset, AssetPrice, AssetType, NetWorthSnapshot } from '@/data/assets';
import { supabase } from '@/lib/supabase';

import { RemoteError } from './api';
import { QuotaError } from './planning';

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
type PriceRow = { symbol: string; price: string | number; currency: string; fetched_at: string };
type SnapshotRow = { date: string; total: number; assets_total: number; liabilities_total: number; currency: string };

export const toAsset = (r: AssetRow): Asset => ({
  id: r.id, type: r.type, symbol: opt(r.symbol), name: r.name, quantity: optNum(r.quantity), buyPrice: optNum(r.buy_price), currency: r.currency,
  buyDate: opt(r.buy_date), valueOverride: optNum(r.value_override), notes: opt(r.notes), priceKey: opt(r.price_key), createdAt: r.created_at,
});
const toPrice = (r: PriceRow): AssetPrice => ({ symbol: r.symbol, price: Number(r.price), currency: r.currency, fetchedAt: r.fetched_at });
const toSnapshot = (r: SnapshotRow): NetWorthSnapshot => ({
  date: r.date, total: Number(r.total), assetsTotal: Number(r.assets_total), liabilitiesTotal: Number(r.liabilities_total), currency: r.currency,
});

export type AssetsData = { assets: Asset[]; prices: Record<string, AssetPrice>; snapshots: NetWorthSnapshot[] };

/** Aset milik pengguna, harga untuk kunci yang dipakai, dan snapshot setahun terakhir. */
export async function loadAssets(sinceYmd: string): Promise<AssetsData> {
  const [assets, snapshots] = await Promise.all([
    supabase.from('assets').select('*').order('created_at').returns<AssetRow[]>(),
    supabase.from('net_worth_snapshots').select('date, total, assets_total, liabilities_total, currency').gte('date', sinceYmd).order('date').returns<SnapshotRow[]>(),
  ]);
  const list = must(assets).map(toAsset);
  return { assets: list, prices: await loadPrices(list), snapshots: must(snapshots).map(toSnapshot) };
}

export async function loadPrices(assets: Asset[]): Promise<Record<string, AssetPrice>> {
  const keys = [...new Set(assets.map((a) => a.priceKey).filter((k): k is string => !!k))];
  if (keys.length === 0) return {};
  const rows = must(await supabase.from('asset_prices').select('symbol, price, currency, fetched_at').in('symbol', keys).returns<PriceRow[]>());
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
