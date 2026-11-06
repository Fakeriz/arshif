import type { Asset, AssetPrice, AssetType, NetWorthSnapshot } from '@/data/assets';
import type { Debt } from '@/data/planning';
import type { Account } from '@/data/types';
import { isCreditType } from '@/lib/credit';
import { tryConvert } from '@/lib/fx';
import type { Lang } from '@/i18n/types';
import { currencyMeta } from '@/lib/money';

export const LIVE_TYPES: readonly AssetType[] = ['stock_id', 'stock_us', 'crypto', 'gold'];
export const MANUAL_TYPES: readonly AssetType[] = ['property', 'vehicle', 'other'];
export const ASSET_TYPES: readonly AssetType[] = [...LIVE_TYPES, ...MANUAL_TYPES];
export const isLiveType = (t: AssetType): boolean => LIVE_TYPES.includes(t);

/** Sama dengan check `assets.symbol` di migrasi 16. */
export const SYMBOL_RE = /^[A-Z0-9.]{1,15}$/;
export const GOLD_SYMBOL = 'XAU';
/** Harga emas dikutip per troy ounce; jumlah emas dicatat dalam gram. */
export const TROY_OUNCE_GRAMS = 31.1034768;
/** Harga live lebih tua dari ini ditandai "harga terakhir", bukan harga terkini. */
export const STALE_MS = 6 * 60 * 60 * 1000;

const PREFIX: Partial<Record<AssetType, string>> = { stock_id: 'IDX', stock_us: 'US', crypto: 'CRYPTO', gold: 'GOLD' };

/** Kunci harga netral, cermin kolom `assets.price_key` di server. */
export function priceKeyOf(type: AssetType, symbol: string | undefined): string | undefined {
  const prefix = PREFIX[type];
  return prefix && symbol ? `${prefix}:${symbol}` : undefined;
}

/** Stablecoin dolar dihitung sebagai USD supaya bisa dikonversi dengan kurs ECB. */
const quoteCurrency = (code: string): string => (code === 'USDT' || code === 'USDC' ? 'USD' : code.toUpperCase());

/** Bulatkan ke integer setelah memangkas galat float (0,5 × 76039,51 harus ...75,5 lalu naik, bukan ...75,4999). */
const roundMinor = (x: number): number => Math.round(Number(x.toFixed(6)));
export const toMinor = (major: number, code: string): number => roundMinor(major * Math.pow(10, currencyMeta(code).exponent));

export type ValueSource = 'manual' | 'live' | 'buy' | 'none';

export type Valuation = {
  /** Nilai total dalam `currency` (minor units), null bila belum bisa dihitung. */
  value: number | null;
  currency: string;
  source: ValueSource;
  /** Harga per unit (satuan utama, mata uang `currency`). Emas: per gram. */
  unitPrice?: number;
  fetchedAt?: string;
  stale?: boolean;
};

/**
 * Nilai aset, urutan prioritas (brief §7): nilai manual, lalu jumlah × harga live terakhir,
 * lalu jumlah × harga beli (diberi label), selain itu belum ada nilai (tidak pernah Rp 0 palsu).
 */
export function valueAsset(a: Asset, prices: Record<string, AssetPrice>, now: number): Valuation {
  if (a.valueOverride !== undefined) return { value: a.valueOverride, currency: a.currency, source: 'manual' };
  const price = a.priceKey ? prices[a.priceKey] : undefined;
  if (price && a.quantity !== undefined) {
    const currency = quoteCurrency(price.currency);
    const unitPrice = a.type === 'gold' ? price.price / TROY_OUNCE_GRAMS : price.price;
    return {
      value: toMinor(a.quantity * unitPrice, currency),
      currency,
      source: 'live',
      unitPrice,
      fetchedAt: price.fetchedAt,
      stale: now - Date.parse(price.fetchedAt) > STALE_MS,
    };
  }
  if (a.buyPrice !== undefined && a.quantity !== undefined) {
    return { value: roundMinor(a.quantity * a.buyPrice), currency: a.currency, source: 'buy' };
  }
  return { value: null, currency: a.currency, source: 'none' };
}

/** Untung/rugi terhadap harga beli, dalam mata uang aset. null bila harga beli atau nilai tidak ada. */
export function gainOf(a: Asset, v: Valuation): { amount: number; pct: number | null } | null {
  if (a.buyPrice === undefined || a.quantity === undefined || v.value === null || v.source === 'buy') return null;
  const value = tryConvert(v.value, v.currency, a.currency);
  if (value === null) return null;
  const cost = roundMinor(a.quantity * a.buyPrice);
  return { amount: value - cost, pct: cost > 0 ? (value - cost) / cost : null };
}

export type NetWorthInput = {
  accounts: (Account & { balance: number })[];
  assets: Asset[];
  prices: Record<string, AssetPrice>;
  debts: Debt[];
  main: string;
  now: number;
};

export type NetWorth = {
  total: number;
  /** Saldo rekening (bank, dompet, tunai) termasuk kelebihan bayar kartu kredit. */
  cash: number;
  /** Nilai aset yang dilacak. */
  assets: number;
  receivables: number;
  /** Tagihan kartu kredit + paylater yang belum dibayar (positif). */
  credit: number;
  /** Utang aktif dari Planning hub (positif). */
  debts: number;
  assetsTotal: number;
  liabilitiesTotal: number;
  /** Aset yang belum punya nilai (live gagal, tanpa harga beli). */
  unvalued: number;
  /** Item yang dilewati karena kurs mata uangnya belum ada. */
  unconverted: number;
};

/**
 * Kekayaan bersih = (saldo rekening + nilai aset + piutang) − (kartu kredit/paylater + utang).
 * Satu-satunya rumus: Home dan tab Aset sama-sama memakai ini (brief §3, §7).
 */
export function computeNetWorth({ accounts, assets, prices, debts, main, now }: NetWorthInput): NetWorth {
  let cash = 0;
  let credit = 0;
  let assetSum = 0;
  let receivables = 0;
  let debtSum = 0;
  let unvalued = 0;
  let unconverted = 0;
  const conv = (minor: number, from: string): number | null => {
    const v = tryConvert(minor, from, main);
    if (v === null) unconverted++;
    return v;
  };

  for (const a of accounts) {
    const v = conv(a.balance, a.currency);
    if (v === null) continue;
    if (isCreditType(a.type) && v < 0) credit += -v;
    else cash += v;
  }
  for (const a of assets) {
    const val = valueAsset(a, prices, now);
    if (val.value === null) {
      unvalued++;
      continue;
    }
    const v = conv(val.value, val.currency);
    if (v !== null) assetSum += v;
  }
  for (const d of debts) {
    if (d.status !== 'active') continue;
    const v = conv(d.balance, d.currency);
    if (v === null) continue;
    if (d.kind === 'receivable') receivables += v;
    else debtSum += v;
  }

  const assetsTotal = cash + assetSum + receivables;
  const liabilitiesTotal = credit + debtSum;
  return {
    total: assetsTotal - liabilitiesTotal,
    cash,
    assets: assetSum,
    receivables,
    credit,
    debts: debtSum,
    assetsTotal,
    liabilitiesTotal,
    unvalued,
    unconverted,
  };
}

/** Selisih kekayaan bersih hari ini terhadap snapshot tertua dalam `days` hari terakhir (tanpa hari ini). */
export function changeSince(snapshots: NetWorthSnapshot[], total: number, today: string, currency: string, days = 30): { amount: number; since: string } | null {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  const base = snapshots
    .filter((s) => s.date >= from && s.date < today && s.currency === currency)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return base ? { amount: total - base.total, since: base.date } : null;
}

/** Ada aset live yang harganya tidak tersedia atau sudah basi: tampilkan banner. */
export function livePricesDown(assets: Asset[], prices: Record<string, AssetPrice>, now: number): boolean {
  const live = assets.filter((a) => isLiveType(a.type) && a.valueOverride === undefined);
  if (live.length === 0) return false;
  return live.every((a) => {
    const p = a.priceKey ? prices[a.priceKey] : undefined;
    return !p || now - Date.parse(p.fetchedAt) > STALE_MS;
  });
}

export type UnitKey = 'shares' | 'coins' | 'grams' | 'units';
/** Satuan jumlah per jenis: `assets.unit.<key>`. */
export function unitOf(type: AssetType): UnitKey {
  if (type === 'stock_id' || type === 'stock_us') return 'shares';
  if (type === 'crypto') return 'coins';
  if (type === 'gold') return 'grams';
  return 'units';
}

/** "0,5" / "0.5" / "1.250" (lembar) -> angka. Maksimal 10 desimal, sama dengan numeric(28, 10). null = tidak valid. */
export function parseQuantity(text: string): number | null {
  const s = text.trim().replace(/\s/g, '');
  if (!/^\d+([.,]\d{1,10})?$/.test(s)) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Jumlah unit untuk tampilan: pemisah desimal mengikuti bahasa, tanpa nol di belakang. */
export function formatQuantity(n: number, lang: Lang): string {
  const [int, frac] = n.toFixed(10).replace(/\.?0+$/, '').split('.');
  const comma = lang === 'id' || lang === 'tr';
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, comma ? '.' : ',');
  return frac ? `${grouped}${comma ? ',' : '.'}${frac}` : grouped;
}
