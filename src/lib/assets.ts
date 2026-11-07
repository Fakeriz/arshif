import type { Asset, AssetPrice, AssetType, NetWorthSnapshot, PricePoint } from '@/data/assets';
import type { Debt } from '@/data/planning';
import type { Account } from '@/data/types';
import { pctChange } from '@/lib/chart';
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
/**
 * Sync terakhir yang berhasil untuk kode ini lebih tua dari ini = semua penyedia gagal: tandai "harga terakhir".
 * Sync jalan tiap jam, jadi 2 jam = satu sync terlewat plus jeda. Diukur dari waktu sync, bukan waktu quote:
 * harga Jumat sore yang masih disinkronkan saat akhir pekan tetap harga terbaru, bukan harga gagal.
 */
export const STALE_MS = 2 * 60 * 60 * 1000;

const PREFIX: Partial<Record<AssetType, string>> = { stock_id: 'IDX', stock_us: 'US', crypto: 'CRYPTO', gold: 'GOLD' };

/** Kunci harga netral, cermin kolom `assets.price_key` di server. */
export function priceKeyOf(type: AssetType, symbol: string | undefined): string | undefined {
  const prefix = PREFIX[type];
  return prefix && symbol ? `${prefix}:${symbol}` : undefined;
}

/**
 * Simbol grafik TradingView (Live Market v2 §4): IDX:<KODE>, ticker US apa adanya (TradingView memilih bursa utama),
 * kripto BINANCE:<KODE>USDT, emas OANDA:XAUUSD. Stablecoin tidak punya grafik bermakna. Hanya tampilan, bukan harga.
 */
export function chartSymbol(a: Pick<Asset, 'type' | 'symbol'>): string | null {
  if (!a.symbol) return null;
  if (a.type === 'stock_id') return `IDX:${a.symbol}`;
  if (a.type === 'stock_us') return a.symbol;
  if (a.type === 'crypto') return a.symbol === 'USDT' || a.symbol === 'USDC' ? null : `BINANCE:${a.symbol}USDT`;
  if (a.type === 'gold') return 'OANDA:XAUUSD';
  return null;
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
  /** Waktu harga menurut penyedia; tidak ada = hanya waktu sync yang diketahui. */
  quotedAt?: string;
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
      quotedAt: price.quotedAt,
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

/**
 * Untung/rugi portofolio di harga live terhadap harga beli, dalam mata uang utama. Hanya aset yang punya harga beli
 * dan harga live (termasuk harga terakhir yang diketahui); aset harga beli/manual tidak ikut. null bila tidak ada.
 */
export function portfolioGain(assets: Asset[], prices: Record<string, AssetPrice>, now: number, main: string): { value: number; pct: number } | null {
  let value = 0;
  let cost = 0;
  for (const a of assets) {
    const v = valueAsset(a, prices, now);
    if (v.source !== 'live' || v.value === null || a.buyPrice === undefined || a.quantity === undefined) continue;
    const cur = tryConvert(v.value, v.currency, main);
    const basis = tryConvert(roundMinor(a.quantity * a.buyPrice), a.currency, main);
    if (cur === null || basis === null) continue;
    value += cur;
    cost += basis;
  }
  return cost > 0 ? { value, pct: (value - cost) / cost } : null;
}

export type Mover = { assetId: string; label: string; pct: number; delta: number };

/**
 * Penggerak portofolio (Weekly Replay, Fase 5): perubahan nilai aset live selama `days` hari terakhir dari riwayat
 * harga harian, dalam mata uang utama. Patokan = harga hari terakhir yang <= hari ini - days (hari UTC). Aset tanpa
 * riwayat sepanjang itu, nilai manual, atau mata uang riwayat yang beda dilewati. null bila belum ada data seminggu.
 */
export function portfolioMovers(
  assets: Asset[],
  prices: Record<string, AssetPrice>,
  history: Record<string, PricePoint[]>,
  now: number,
  main: string,
  days = 7,
): { total: number; movers: Mover[] } | null {
  const cutoff = new Date(now - days * 86_400_000).toISOString().slice(0, 10);
  let total = 0;
  const movers: Mover[] = [];
  for (const a of assets) {
    const p = a.priceKey ? prices[a.priceKey] : undefined;
    if (!p || a.valueOverride !== undefined || a.quantity === undefined) continue;
    const then = [...(history[a.priceKey!] ?? [])].reverse().find((h) => h.day <= cutoff);
    if (!then || then.currency !== p.currency || then.price <= 0) continue;
    const perUnit = (price: number) => (a.type === 'gold' ? price / TROY_OUNCE_GRAMS : price);
    const currency = quoteCurrency(p.currency);
    const delta = tryConvert(toMinor(a.quantity * (perUnit(p.price) - perUnit(then.price)), currency), currency, main);
    if (delta === null) continue;
    total += delta;
    movers.push({ assetId: a.id, label: a.type === 'gold' || !a.symbol ? a.name : a.symbol, pct: (p.price - then.price) / then.price, delta });
  }
  if (movers.length === 0) return null;
  return { total, movers: movers.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)) };
}

const MARKET_OF: Partial<Record<AssetType, 'IDX' | 'US' | 'CRYPTO' | 'GOLD'>> = { stock_id: 'IDX', stock_us: 'US', crypto: 'CRYPTO', gold: 'GOLD' };

/**
 * Angka ringkasan untuk Tanya harga wajar (FR-COACH-4): kode, pasar, harga live per unit dalam mata uang kutipan,
 * harga beli per unit, perubahan % vs harga beli. TIDAK ada nama, jumlah unit, catatan, atau nilai total.
 * Harga beli hanya dikirim bila satuan dan mata uangnya sama dengan kutipan (emas dicatat per gram, kutipan per ons).
 */
export function priceAskInput(a: Asset, prices: Record<string, AssetPrice>, now: number) {
  const market = MARKET_OF[a.type];
  const p = a.priceKey ? prices[a.priceKey] : undefined;
  if (!market || !a.symbol || !p) return null;
  const currency = quoteCurrency(p.currency);
  const sameUnit = a.type !== 'gold' && a.currency === currency && a.buyPrice !== undefined;
  const gain = gainOf(a, valueAsset(a, prices, now));
  return {
    market,
    symbol: a.symbol,
    currency,
    livePrice: p.price,
    buyPrice: sameUnit ? a.buyPrice! / Math.pow(10, currencyMeta(currency).exponent) : null,
    changePct: gain?.pct == null ? null : Math.round(gain.pct * 1000) / 10,
  };
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

/** Snapshot dalam `days` hari terakhir (tanpa hari ini), terlama dulu. */
function recentSnapshots(snapshots: NetWorthSnapshot[], today: string, currency: string, days: number): NetWorthSnapshot[] {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  return snapshots.filter((s) => s.date >= from && s.date < today && s.currency === currency).sort((a, b) => a.date.localeCompare(b.date));
}

/** Selisih kekayaan bersih hari ini terhadap snapshot tertua dalam `days` hari terakhir (tanpa hari ini). */
export function changeSince(snapshots: NetWorthSnapshot[], total: number, today: string, currency: string, days = 30): { amount: number; since: string } | null {
  const base = recentSnapshots(snapshots, today, currency, days)[0];
  return base ? { amount: total - base.total, since: base.date } : null;
}

/** Deret harian satu kolom snapshot + nilai hari ini, dan perubahan relatif vs titik tertua (pembanding sama dengan changeSince). */
export function snapshotTrend(
  snapshots: NetWorthSnapshot[],
  key: 'assetsTotal' | 'liabilitiesTotal',
  current: number,
  today: string,
  currency: string,
  days = 30,
): { series: number[]; change: number | null } {
  const series = [...recentSnapshots(snapshots, today, currency, days).map((s) => s[key]), current];
  return { series, change: series.length > 1 ? pctChange(series[0], current) : null };
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
