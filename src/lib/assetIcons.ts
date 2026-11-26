import {
  Bike,
  Briefcase,
  Building2,
  Camera,
  Car,
  ChartPie,
  Coffee,
  Coins,
  CreditCard,
  Droplet,
  Flame,
  Fuel,
  Globe,
  HandCoins,
  House,
  Landmark,
  LandPlot,
  Laptop,
  Package,
  PiggyBank,
  ReceiptText,
  Smartphone,
  Sprout,
  TrendingUp,
  Truck,
  Vault,
  Wallet,
  Watch,
  Wheat,
  type LucideIcon,
} from 'lucide-react-native';

import { IDX_LOGO_SLUGS, US_LOGO_SLUGS } from '@/data/assetLogos';
import type { AssetType } from '@/data/assets';
import type { SymbolMarket, SymbolOption } from '@/lib/symbols';

export type LogoSource = { url: string; kind: 'badge' | 'contain' };
export type BalanceRowKind = 'cash' | 'receivables' | 'credit' | 'debts';
export type AssetVisualSpec = { urls: LogoSource[]; monogram?: string; icon: LucideIcon };

const TV_LOGO_BASE = 'https://s3-symbol-logo.tradingview.com';
const FMP_LOGO_BASE = 'https://financialmodelingprep.com/image-stock';
const NVSTLY_LOGO_BASE = 'https://cdn.jsdelivr.net/gh/nvstly/icons@main/ticker_icons';
const SPOTHQ_CRYPTO_BASE = 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color';

/**
 * URL ikon statis CoinGecko untuk 18 koin di CRYPTO_COINS (diambil dari /coins/markets).
 * Disimpan statis agar runtime tidak memanggil API CoinGecko hanya untuk mencari gambar.
 */
export const COINGECKO_ICON_URLS: Readonly<Record<string, string>> = {
  BTC: 'https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400',
  ETH: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png?1696501628',
  USDT: 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661',
  USDC: 'https://coin-images.coingecko.com/coins/images/6319/large/USDC.png?1769615602',
  BNB: 'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png?1696501970',
  SOL: 'https://coin-images.coingecko.com/coins/images/4128/large/solana.png?1718769756',
  XRP: 'https://coin-images.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png?1696501442',
  DOGE: 'https://coin-images.coingecko.com/coins/images/5/large/dogecoin.png?1696501409',
  ADA: 'https://coin-images.coingecko.com/coins/images/975/large/cardano.png?1696502090',
  TRX: 'https://coin-images.coingecko.com/coins/images/1094/large/photo_2026-04-13_09-59-16.png?1776048311',
  TON: 'https://coin-images.coingecko.com/coins/images/17980/large/Gram_Circular_Badge.png?1781524778',
  AVAX: 'https://coin-images.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png?1696512369',
  DOT: 'https://coin-images.coingecko.com/coins/images/12171/large/polkadot.jpg?1766533446',
  LINK: 'https://coin-images.coingecko.com/coins/images/877/large/Chainlink_Logo_500.png?1760023405',
  POL: 'https://coin-images.coingecko.com/coins/images/32440/large/pol.png?1759114181',
  LTC: 'https://coin-images.coingecko.com/coins/images/2/large/litecoin.png?1696501400',
  SHIB: 'https://coin-images.coingecko.com/coins/images/11939/large/shiba.png?1696511800',
  BCH: 'https://coin-images.coingecko.com/coins/images/780/large/bitcoin-cash-circle.png?1696501932',
};

export type CommoditySpec = {
  slug: string;
  symbols: readonly string[];
  pattern: RegExp;
  icon: LucideIcon;
};

/**
 * Spesifikasi komoditas dengan slug TradingView terverifikasi (ID/MS/TR/EN).
 * Logam non-emas dicek lebih dulu agar nama seperti "Perak Antam" tidak tersalah cocok.
 */
export const COMMODITY_SPECS: readonly CommoditySpec[] = [
  { slug: 'metal/silver', symbols: ['XAG', 'SILVER'], pattern: /\b(?:perak|silver|gumus|xag)\b/, icon: Coins },
  { slug: 'metal/platinum', symbols: ['XPT', 'PLATINUM'], pattern: /\b(?:platina|platinum|platin|xpt)\b/, icon: Coins },
  { slug: 'metal/palladium', symbols: ['XPD', 'PALLADIUM'], pattern: /\b(?:paladium|palladium|paladyum|xpd)\b/, icon: Coins },
  { slug: 'metal/copper', symbols: ['XCU', 'COPPER'], pattern: /\b(?:tembaga|copper|bakir|xcu)\b/, icon: Coins },
  { slug: 'metal/gold', symbols: ['XAU', 'GOLD'], pattern: /\b(?:emas|gold|altin|logam mulia|xau)\b/, icon: Coins },
  { slug: 'crude-oil', symbols: ['USOIL', 'UKOIL', 'WTI', 'BRENT', 'CL'], pattern: /\b(?:minyak mentah|crude oil|brent|wti|ham petrol)\b/, icon: Droplet },
  { slug: 'natural-gas', symbols: ['NG', 'NATGAS', 'XNG'], pattern: /\b(?:gas alam|natural gas|dogalgaz|dogal gaz|natgas|lng)\b/, icon: Flame },
  { slug: 'gasoline', symbols: ['RBOB', 'GASOLINE'], pattern: /\b(?:bensin|gasoline|benzin|rbob)\b/, icon: Fuel },
  { slug: 'coal', symbols: ['COAL'], pattern: /\b(?:batu bara|batubara|coal|komur)\b/, icon: Flame },
  { slug: 'coffee', symbols: ['KC', 'COFFEE'], pattern: /\b(?:kopi|coffee|kahve|arabika|arabica|robusta)\b/, icon: Coffee },
  { slug: 'wheat', symbols: ['ZW', 'WHEAT'], pattern: /\b(?:gandum|wheat|bugday)\b/, icon: Wheat },
  { slug: 'corn', symbols: ['ZC', 'CORN'], pattern: /\b(?:jagung|corn|misir)\b/, icon: Wheat },
  { slug: 'sugar', symbols: ['SB', 'SUGAR'], pattern: /\b(?:gula|sugar|seker)\b/, icon: Package },
  { slug: 'cocoa', symbols: ['CC', 'COCOA'], pattern: /\b(?:kakao|cocoa|cacao|cokelat|coklat)\b/, icon: Coffee },
  { slug: 'cotton', symbols: ['CT', 'COTTON'], pattern: /\b(?:kapas|cotton|pamuk)\b/, icon: Sprout },
];

const MARKET_TO_ASSET_TYPE: Record<SymbolMarket, AssetType> = {
  IDX: 'stock_id',
  US: 'stock_us',
  CRYPTO: 'crypto',
};

const BALANCE_ROW_ICONS: Record<BalanceRowKind, LucideIcon> = {
  cash: Wallet,
  receivables: HandCoins,
  credit: CreditCard,
  debts: ReceiptText,
};

function normalizeText(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/[ıİ]/g, 'i')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function cleanMonogram(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  return cleaned || undefined;
}

function tvBadge(slug: string): LogoSource {
  return { url: `${TV_LOGO_BASE}/${slug}--96.png`, kind: 'badge' };
}

function matchCommodity(symbol?: string, name?: string, notes?: string): CommoditySpec | undefined {
  const code = symbol?.trim().toUpperCase();
  if (code) {
    const bySymbol = COMMODITY_SPECS.find((c) => c.symbols.includes(code));
    if (bySymbol) return bySymbol;
  }
  const text = `${normalizeText(name)} ${normalizeText(notes)}`.trim();
  if (!text) return undefined;
  return COMMODITY_SPECS.find((c) => c.pattern.test(text));
}

function propertyIcon(name?: string, notes?: string): LucideIcon {
  const text = `${normalizeText(name)} ${normalizeText(notes)}`;
  if (/\b(?:apartemen|apartment|apt|ruko|gedung|kantor|kos|kost|kondominium|condominium|condo|daire|ofis|flat|studio|tower)\b/.test(text)) {
    return Building2;
  }
  if (/\b(?:tanah|kavling|kapling|kebun|sawah|lahan|ladang|pekarangan|arsa|tarla|land|plot)\b/.test(text)) {
    return LandPlot;
  }
  return House;
}

function vehicleIcon(name?: string, notes?: string): LucideIcon {
  const text = `${normalizeText(name)} ${normalizeText(notes)}`;
  if (/\b(?:motor|sepeda motor|motosikal|sepeda|vespa|skuter|scooter|motosiklet|bisiklet|vario|beat|nmax|pcx|aerox|scoopy|motorcycle|motorbike|bike)\b/.test(text)) {
    return Bike;
  }
  if (/\b(?:truk|truck|pickup|pick up|mobil box|mobil boks|kamyon|kamyonet|lori|lorry|van)\b/.test(text)) {
    return Truck;
  }
  return Car;
}

function otherIcon(name?: string, notes?: string): LucideIcon {
  const text = `${normalizeText(name)} ${normalizeText(notes)}`;
  if (/\b(?:sbn|ori\d*|sukuk|sbr\d*|st\d{2,}|sr\d{2,}|fr\d{2,}|pbs\d*|obligasi|bond|bonds|treasury|t-bill|tbill|tahvil|bono)\b/.test(text)) {
    return Landmark;
  }
  if (/\b(?:reksa dana|reksadana|rdpu|rdpt|rds|rdc|mutual fund|unit trust|amanah saham|asb|yatirim fonu)\b/.test(text)) {
    return ChartPie;
  }
  if (/\b(?:deposito|simpanan berjangka|time deposit|fixed deposit|term deposit|vadeli)\b/.test(text)) {
    return PiggyBank;
  }
  if (/\b(?:jam tangan|arloji|watch|rolex|seiko|omega|casio|patek|tudor|tag heuer|g-shock|saat)\b/.test(text)) {
    return Watch;
  }
  if (/\b(?:laptop|macbook|komputer|computer|pc|notebook|imac|thinkpad|chromebook)\b/.test(text)) {
    return Laptop;
  }
  if (/\b(?:hp|handphone|ponsel|iphone|ipad|tablet|smartphone|telefon)\b/.test(text)) {
    return Smartphone;
  }
  if (/\b(?:kamera|camera|lensa|lens|fujifilm|sony alpha|canon|nikon|leica|gopro|dslr|mirrorless)\b/.test(text)) {
    return Camera;
  }
  if (/\b(?:brankas|safe|vault|kasa)\b/.test(text)) {
    return Vault;
  }
  return Briefcase;
}

/** Tentukan rantai sumber logo, monogram fallback, dan ikon Lucide untuk sebuah aset. */
export function resolveAssetVisual(input: {
  type: AssetType;
  symbol?: string;
  name?: string;
  notes?: string;
}): AssetVisualSpec {
  const code = input.symbol?.trim().toUpperCase();

  if (input.type === 'stock_id') {
    const urls: LogoSource[] = [];
    if (code) {
      const slug = IDX_LOGO_SLUGS[code];
      if (slug) urls.push(tvBadge(slug));
      urls.push({ url: `${FMP_LOGO_BASE}/${encodeURIComponent(code)}.JK.png`, kind: 'contain' });
    }
    return { urls, monogram: cleanMonogram(code), icon: TrendingUp };
  }

  if (input.type === 'stock_us') {
    const urls: LogoSource[] = [];
    if (code) {
      const slug = US_LOGO_SLUGS[code];
      if (slug) urls.push(tvBadge(slug));
      urls.push({ url: `${FMP_LOGO_BASE}/${encodeURIComponent(code)}.png`, kind: 'contain' });
      if (code.includes('.')) {
        urls.push({ url: `${FMP_LOGO_BASE}/${encodeURIComponent(code.replace(/\./g, '-'))}.png`, kind: 'contain' });
      }
      urls.push({ url: `${NVSTLY_LOGO_BASE}/${encodeURIComponent(code)}.png`, kind: 'contain' });
    }
    return { urls, monogram: cleanMonogram(code), icon: Globe };
  }

  if (input.type === 'crypto') {
    const urls: LogoSource[] = [];
    if (code) {
      urls.push(tvBadge(`crypto/XTVC${encodeURIComponent(code)}`));
      const cg = COINGECKO_ICON_URLS[code];
      if (cg) urls.push({ url: cg, kind: 'contain' });
      urls.push({ url: `${SPOTHQ_CRYPTO_BASE}/${encodeURIComponent(code.toLowerCase())}.png`, kind: 'contain' });
    }
    return { urls, monogram: cleanMonogram(code), icon: Coins };
  }

  if (input.type === 'gold') {
    return { urls: [tvBadge('metal/gold')], icon: Coins };
  }

  if (input.type === 'property') {
    return { urls: [], icon: propertyIcon(input.name, input.notes) };
  }

  if (input.type === 'vehicle') {
    return { urls: [], icon: vehicleIcon(input.name, input.notes) };
  }

  const commodity = matchCommodity(code, input.name, input.notes);
  if (commodity) {
    return { urls: [tvBadge(commodity.slug)], icon: commodity.icon };
  }

  return { urls: [], icon: otherIcon(input.name, input.notes) };
}

/** Tentukan visual untuk pilihan simbol pada SymbolPicker. */
export function resolveSymbolVisual(option: SymbolOption): AssetVisualSpec {
  return resolveAssetVisual({
    type: MARKET_TO_ASSET_TYPE[option.market],
    symbol: option.code,
    name: option.name,
  });
}

/** Tentukan visual untuk baris ringkasan neraca pada tab Aset. */
export function resolveBalanceRowVisual(kind: BalanceRowKind): AssetVisualSpec {
  return { urls: [], icon: BALANCE_ROW_ICONS[kind] };
}
