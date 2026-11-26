import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  Bike,
  Briefcase,
  Building2,
  Camera,
  Car,
  ChartPie,
  Coins,
  CreditCard,
  HandCoins,
  House,
  Landmark,
  LandPlot,
  Laptop,
  PiggyBank,
  ReceiptText,
  Smartphone,
  Truck,
  Wallet,
  Watch,
} from 'lucide-react-native';
import type { ReactNode } from 'react';

import { AssetIcon } from '@/components/ui';
import { IDX_LOGO_SLUGS, US_LOGO_SLUGS } from '@/data/assetLogos';
import {
  COINGECKO_ICON_URLS,
  resolveAssetVisual,
  resolveBalanceRowVisual,
  resolveSymbolVisual,
} from '@/lib/assetIcons';
import { CRYPTO_COINS } from '@/lib/symbols';
import { InkCard, ThemeProvider } from '@/theme/ThemeProvider';

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: Record<string, unknown>) => React.createElement(View, { testID: 'asset-logo-image', ...props }),
  };
});

function wrap(ui: ReactNode, mode: 'light' | 'dark' = 'dark') {
  return render(<ThemeProvider initialMode={mode}>{ui}</ThemeProvider>);
}

describe('snapshot assetLogos.ts', () => {
  it('IDX_LOGO_SLUGS memuat >= 800 saham BEI termasuk blue-chip utama dengan kunci dan slug aman', () => {
    const entries = Object.entries(IDX_LOGO_SLUGS);
    expect(entries.length).toBeGreaterThanOrEqual(800);
    for (const sym of ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'ANTM', 'GOTO', 'BREN', 'AMRT', 'ICBP', 'UNVR']) {
      expect(IDX_LOGO_SLUGS[sym]).toBeTruthy();
    }
    for (const [code, slug] of entries) {
      expect(code).toMatch(/^[A-Z0-9.]{1,15}$/);
      expect(slug).toMatch(/^[a-z0-9][a-z0-9/_-]*$/);
    }
  });

  it('US_LOGO_SLUGS memuat >= 1.800 saham & ETF AS termasuk ticker utama dengan kunci dan slug aman', () => {
    const entries = Object.entries(US_LOGO_SLUGS);
    expect(entries.length).toBeGreaterThanOrEqual(1800);
    for (const sym of ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'BRK.B', 'SPY', 'VOO', 'QQQ', 'SCHD', 'GLD', 'SLV', 'IBIT', 'IEFA', 'QUAL']) {
      expect(US_LOGO_SLUGS[sym]).toBeTruthy();
    }
    for (const [code, slug] of entries) {
      expect(code).toMatch(/^[A-Z0-9.]{1,15}$/);
      expect(slug).toMatch(/^[a-z0-9][a-z0-9/_-]*$/);
    }
  });
});

describe('resolveAssetVisual & resolveSymbolVisual', () => {
  it('IDX: saham dikenal memakai TradingView badge lalu FMP .JK + monogram', () => {
    const bbca = resolveAssetVisual({ type: 'stock_id', symbol: 'BBCA', name: 'Bank Central Asia' });
    expect(bbca.urls).toEqual([
      { url: `https://s3-symbol-logo.tradingview.com/${IDX_LOGO_SLUGS.BBCA}--96.png`, kind: 'badge' },
      { url: 'https://financialmodelingprep.com/image-stock/BBCA.JK.png', kind: 'contain' },
    ]);
    expect(bbca.monogram).toBe('BBCA');

    const ipo = resolveAssetVisual({ type: 'stock_id', symbol: 'BACH', name: 'Emiten IPO Baru' });
    expect(ipo.urls).toEqual([{ url: 'https://financialmodelingprep.com/image-stock/BACH.JK.png', kind: 'contain' }]);
    expect(ipo.monogram).toBe('BACH');

    const unknown = resolveAssetVisual({ type: 'stock_id', symbol: 'ZZZZ', name: 'Unknown' });
    expect(unknown.urls).toEqual([{ url: 'https://financialmodelingprep.com/image-stock/ZZZZ.JK.png', kind: 'contain' }]);
    expect(unknown.monogram).toBe('ZZZZ');
  });

  it('US & ETF: BRK.B menyertakan TradingView, FMP BRK.B, FMP BRK-B, dan nvstly; micro-cap dan ETF komoditas aman', () => {
    const brk = resolveAssetVisual({ type: 'stock_us', symbol: 'BRK.B', name: 'Berkshire Hathaway' });
    expect(brk.urls).toEqual([
      { url: `https://s3-symbol-logo.tradingview.com/${US_LOGO_SLUGS['BRK.B']}--96.png`, kind: 'badge' },
      { url: 'https://financialmodelingprep.com/image-stock/BRK.B.png', kind: 'contain' },
      { url: 'https://financialmodelingprep.com/image-stock/BRK-B.png', kind: 'contain' },
      { url: 'https://cdn.jsdelivr.net/gh/nvstly/icons@main/ticker_icons/BRK.B.png', kind: 'contain' },
    ]);
    expect(brk.monogram).toBe('BRKB');

    const micro = resolveAssetVisual({ type: 'stock_us', symbol: 'XYZW', name: 'Microcap Corp' });
    expect(micro.urls).toEqual([
      { url: 'https://financialmodelingprep.com/image-stock/XYZW.png', kind: 'contain' },
      { url: 'https://cdn.jsdelivr.net/gh/nvstly/icons@main/ticker_icons/XYZW.png', kind: 'contain' },
    ]);
    expect(micro.monogram).toBe('XYZW');

    // ETF komoditas (GLD, SLV) tetap memakai rantai logo stock_us, bukan ditimpa kata kunci komoditas manual.
    const gld = resolveAssetVisual({ type: 'stock_us', symbol: 'GLD', name: 'SPDR Gold Shares' });
    expect(gld.urls[0].url).toBe(`https://s3-symbol-logo.tradingview.com/${US_LOGO_SLUGS.GLD}--96.png`);
    expect(gld.urls[0].url).not.toContain('metal/gold');
    expect(gld.monogram).toBe('GLD');

    const slv = resolveAssetVisual({ type: 'stock_us', symbol: 'SLV', name: 'iShares Silver Trust' });
    expect(slv.urls[0].url).toBe(`https://s3-symbol-logo.tradingview.com/${US_LOGO_SLUGS.SLV}--96.png`);
    expect(slv.urls[0].url).not.toContain('metal/silver');
    expect(slv.monogram).toBe('SLV');
  });

  it('Crypto: semua 18 koin CRYPTO_COINS punya TradingView, CoinGecko CDN statis, dan spothq CC0', () => {
    expect(CRYPTO_COINS.length).toBe(18);
    for (const [code, name] of CRYPTO_COINS) {
      expect(COINGECKO_ICON_URLS[code]).toMatch(/^https:\/\/coin-images\.coingecko\.com\//);
      const spec = resolveAssetVisual({ type: 'crypto', symbol: code, name });
      expect(spec.urls).toEqual([
        { url: `https://s3-symbol-logo.tradingview.com/crypto/XTVC${code}--96.png`, kind: 'badge' },
        { url: COINGECKO_ICON_URLS[code], kind: 'contain' },
        { url: `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${code.toLowerCase()}.png`, kind: 'contain' },
      ]);
      expect(spec.monogram).toBe(code.slice(0, 4));
    }
    expect(resolveSymbolVisual({ code: 'TON', name: 'Gram (prev. Toncoin)', market: 'CRYPTO' }).urls[1].url).toBe(COINGECKO_ICON_URLS.TON);
    expect(resolveSymbolVisual({ code: 'POL', name: 'POL (ex-MATIC)', market: 'CRYPTO' }).urls[1].url).toBe(COINGECKO_ICON_URLS.POL);
  });

  it('Emas dan komoditas multibahasa cocok akurat tanpa false positive', () => {
    const gold = resolveAssetVisual({ type: 'gold', symbol: 'XAU', name: 'Emas Antam' });
    expect(gold.urls).toEqual([{ url: 'https://s3-symbol-logo.tradingview.com/metal/gold--96.png', kind: 'badge' }]);
    expect(gold.monogram).toBeUndefined();
    expect(gold.icon).toBe(Coins);

    const cases: [string, string][] = [
      ['Perak Antam 100g', 'metal/silver'],
      ['Silver Bullion', 'metal/silver'],
      ['Platinum Bar', 'metal/platinum'],
      ['Minyak Mentah WTI', 'crude-oil'],
      ['Gas Alam', 'natural-gas'],
      ['Kopi Arabika', 'coffee'],
      ['Gandum', 'wheat'],
    ];
    for (const [name, slug] of cases) {
      const spec = resolveAssetVisual({ type: 'other', name });
      expect(spec.urls).toEqual([{ url: `https://s3-symbol-logo.tradingview.com/${slug}--96.png`, kind: 'badge' }]);
    }

    // Tidak boleh false-match "oil" pada "Mobil Honda" atau "Obligasi FR0097".
    const car = resolveAssetVisual({ type: 'vehicle', name: 'Mobil Honda' });
    expect(car.urls).toEqual([]);
    expect(car.icon).toBe(Car);

    const bond = resolveAssetVisual({ type: 'other', name: 'Obligasi FR0097' });
    expect(bond.urls).toEqual([]);
    expect(bond.icon).toBe(Landmark);
  });

  it('Aset manual (property, vehicle, other) dan baris neraca memetakan ikon semantik', () => {
    expect(resolveAssetVisual({ type: 'property', name: 'Apartemen Sudirman' }).icon).toBe(Building2);
    expect(resolveAssetVisual({ type: 'property', name: 'Tanah Kavling Bogor' }).icon).toBe(LandPlot);
    expect(resolveAssetVisual({ type: 'property', name: 'Rumah Tinggal' }).icon).toBe(House);

    expect(resolveAssetVisual({ type: 'vehicle', name: 'Motor Vario' }).icon).toBe(Bike);
    expect(resolveAssetVisual({ type: 'vehicle', name: 'Truk Engkel' }).icon).toBe(Truck);
    expect(resolveAssetVisual({ type: 'vehicle', name: 'Mobil Avanza' }).icon).toBe(Car);

    expect(resolveAssetVisual({ type: 'other', name: 'ORI025 / SBN' }).icon).toBe(Landmark);
    expect(resolveAssetVisual({ type: 'other', name: 'Reksa Dana Pasar Uang' }).icon).toBe(ChartPie);
    expect(resolveAssetVisual({ type: 'other', name: 'Deposito BCA' }).icon).toBe(PiggyBank);
    expect(resolveAssetVisual({ type: 'other', name: 'Jam Tangan Seiko' }).icon).toBe(Watch);
    expect(resolveAssetVisual({ type: 'other', name: 'MacBook Pro' }).icon).toBe(Laptop);
    expect(resolveAssetVisual({ type: 'other', name: 'iPhone 16' }).icon).toBe(Smartphone);
    expect(resolveAssetVisual({ type: 'other', name: 'Kamera Sony' }).icon).toBe(Camera);
    expect(resolveAssetVisual({ type: 'other', name: ' Koleksi ' }).icon).toBe(Briefcase);

    expect(resolveBalanceRowVisual('cash').icon).toBe(Wallet);
    expect(resolveBalanceRowVisual('receivables').icon).toBe(HandCoins);
    expect(resolveBalanceRowVisual('credit').icon).toBe(CreditCard);
    expect(resolveBalanceRowVisual('debts').icon).toBe(ReceiptText);
  });
});

describe('<AssetIcon />', () => {
  it('merender aman di tema terang, tema gelap, dan di dalam InkCard tanpa mencemari aksesibilitas', async () => {
    const asset = { type: 'stock_id' as const, symbol: 'BBCA', name: 'Bank Central Asia' };
    const light = await wrap(<AssetIcon asset={asset} size={40} />, 'light');
    expect(JSON.stringify(light.toJSON())).toContain('"BBCA"');
    expect(screen.queryByText('BBCA')).toBeNull();
    expect(screen.queryByLabelText('BBCA')).toBeNull();
    await light.unmount();

    const ink = await wrap(
      <InkCard>
        <AssetIcon asset={asset} size={48} />
      </InkCard>,
      'dark',
    );
    expect(JSON.stringify(ink.toJSON())).toContain('"BBCA"');
    await ink.unmount();

    const balance = await wrap(<AssetIcon kind="cash" size={40} />, 'dark');
    expect(screen.queryByTestId('asset-logo-image', { includeHiddenElements: true })).toBeNull();
    await balance.unmount();
  });

  it('fallback progresif: error beruntun melompat dari Tier 1 -> Tier 2 -> Tier 3 -> monogram tanpa crash', async () => {
    const rendered = await wrap(<AssetIcon symbolOption={{ code: 'BTC', name: 'Bitcoin', market: 'CRYPTO' }} size={40} />);
    const spec = resolveAssetVisual({ type: 'crypto', symbol: 'BTC', name: 'Bitcoin' });
    expect(spec.urls.length).toBe(3);

    // Tier 1: TradingView
    let img = screen.getByTestId('asset-logo-image', { includeHiddenElements: true });
    expect(img.props.source).toEqual({ uri: spec.urls[0].url });

    // Error Tier 1 -> Tier 2: CoinGecko
    await act(async () => {
      fireEvent(img, 'error');
    });
    img = screen.getByTestId('asset-logo-image', { includeHiddenElements: true });
    expect(img.props.source).toEqual({ uri: spec.urls[1].url });

    // Error Tier 2 -> Tier 3: spothq CC0
    await act(async () => {
      fireEvent(img, 'error');
    });
    img = screen.getByTestId('asset-logo-image', { includeHiddenElements: true });
    expect(img.props.source).toEqual({ uri: spec.urls[2].url });

    // Error Tier 3 -> semua URL habis, Image dilepas, monogram tetap tampil
    await act(async () => {
      fireEvent(img, 'error');
    });
    expect(screen.queryByTestId('asset-logo-image', { includeHiddenElements: true })).toBeNull();
    expect(JSON.stringify(rendered.toJSON())).toContain('"BTC"');
  });

  it('saat gambar berhasil dimuat, fallback monogram disembunyikan', async () => {
    const rendered = await wrap(<AssetIcon asset={{ type: 'stock_id', symbol: 'BBCA', name: 'BCA' }} size={40} />);
    expect(JSON.stringify(rendered.toJSON())).toContain('"BBCA"');

    await act(async () => {
      fireEvent(screen.getByTestId('asset-logo-image', { includeHiddenElements: true }), 'load');
    });
    expect(JSON.stringify(rendered.toJSON())).not.toContain('"BBCA"');
  });
});
