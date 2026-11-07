/** Fase Aset (docs/arshif-fase-aset-brief.md). Nominal uang = minor units; jumlah unit = angka desimal. */

export type AssetType = 'stock_id' | 'stock_us' | 'crypto' | 'gold' | 'property' | 'vehicle' | 'other';

export type Asset = {
  id: string;
  type: AssetType;
  /** BBCA, AAPL, BTC, XAU. Kosong untuk aset manual. */
  symbol?: string;
  name: string;
  /** Lembar, koin, gram, atau unit. */
  quantity?: number;
  /** Harga beli per unit (minor units, mata uang `currency`). */
  buyPrice?: number;
  currency: string;
  buyDate?: string;
  /** Nilai total manual (minor units, mata uang `currency`). Bila ada, harga live diabaikan. */
  valueOverride?: number;
  notes?: string;
  /** Kunci harga netral: IDX:BBCA, US:AAPL, CRYPTO:BTC, GOLD:XAU. */
  priceKey?: string;
  createdAt: string;
};

/** Harga terakhir per kunci pasar, per unit dalam satuan utama (emas: per troy ounce). */
/** `fetchedAt` = waktu sync Arshif; `quotedAt` = waktu harga menurut penyedia (tidak ada di baris lama). */
export type AssetPrice = { symbol: string; price: number; currency: string; fetchedAt: string; quotedAt?: string };

/** Alert harga satu aset (Fase 5): sekali beri tahu saat harga bergerak >= pct% dari basePrice (diisi server). */
export type AssetAlert = { id: string; assetId: string; pct: number; basePrice: number; currency: string; triggeredAt?: string };

/** Harga penutupan harian per kunci (hari UTC), untuk penggerak portofolio di Weekly Replay. */
export type PricePoint = { day: string; price: number; currency: string };

export type NetWorthSnapshot = { date: string; total: number; assetsTotal: number; liabilitiesTotal: number; currency: string };
