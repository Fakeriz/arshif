import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CardArt } from '@/components/ui/CardArt';
import { BANKS } from '@/constants/banks';
import { I18nProvider } from '@/i18n';
import { BANK_LOGOS, fitLogo, logoAspect, monoSvg, PAYLATER_LOGOS, SCHEME_LOGOS, visibleColors } from '@/lib/finlogos';
import { ThemeProvider } from '@/theme/ThemeProvider';

// Tanpa @types/node: fs lewat jest dengan tipe minimal (pola yang sama dengan i18n.test.ts).
declare const __dirname: string;
const { readFileSync } = jest.requireActual<{ readFileSync(p: string, enc: 'utf8'): string }>('fs');
const PKG = `${__dirname}/../../node_modules/idn-finlogos/dist`;
const manifest = JSON.parse(readFileSync(`${PKG}/manifest.json`, 'utf8')) as {
  version: string;
  logos: { slug: string }[];
};
const slugs = new Set(manifest.logos.map((l) => l.slug));
const all = [...Object.values(BANK_LOGOS), ...Object.values(PAYLATER_LOGOS), ...Object.values(SCHEME_LOGOS)];

describe('logo idn-finlogos', () => {
  it('setiap slug yang dipakai ada di manifest paket (tidak ditebak) dan isinya SVG asli dari slug itu', () => {
    expect(manifest.version).toBe('2.5.0');
    for (const l of all) {
      expect(slugs.has(l.slug)).toBe(true);
      const file = readFileSync(`${PKG}/icons/${l.slug}.svg`, 'utf8');
      expect(l.svg).toBe(file);
    }
  });
  it('semua bank/e-wallet/paylater Indonesia di pemilih punya logo; Malaysia dan Turki tidak (teks)', () => {
    const id = BANKS.filter((b) => b.country === 'ID').map((b) => b.key);
    expect(id.filter((k) => !BANK_LOGOS[k])).toEqual([]);
    expect(BANKS.filter((b) => b.country === 'MY' || b.country === 'TR').filter((b) => BANK_LOGOS[b.key])).toEqual([]);
    expect(SCHEME_LOGOS.troy).toBeUndefined();
  });
  it('rasio logo dari viewBox', () => {
    expect(logoAspect(BANK_LOGOS.bca.svg)).toBeCloseTo(80 / 26);
    expect(logoAspect('<svg>')).toBe(1);
  });
});

const wrap = async (ui: React.ReactElement) => {
  await act(async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <I18nProvider initialLang="id">
          <ThemeProvider initialMode="dark">{ui}</ThemeProvider>
        </I18nProvider>
      </SafeAreaProvider>,
    );
  });
};

describe('warna logo menyesuaikan kartu (latar transparan, bentuk tetap)', () => {
  const shape = (svg: string) => svg.replace(/(fill|stroke|stop-color)="[^"]*"/g, '');
  const BCA_CARD = '#0060AF';
  const LIGHT_CARD = '#F3F3F3';

  it('kartu BCA biru: logo BCA (biru asli) jadi putih = tinta kartu; bentuk dan clipPath tidak berubah', () => {
    const out = fitLogo(BANK_LOGOS.bca.svg, BCA_CARD, '#FFFFFF', 'brand');
    expect(out).not.toContain('#0060AF');
    expect(visibleColors(out)).toEqual([]);
    expect(out).toContain('fill="#FFFFFF"');
    expect(shape(out)).toBe(shape(BANK_LOGOS.bca.svg));
    expect(out.match(/<clipPath[\s\S]*?<\/clipPath>/)?.[0]).toBe(BANK_LOGOS.bca.svg.match(/<clipPath[\s\S]*?<\/clipPath>/)?.[0]);
  });
  it('kartu terang: logo BCA tetap warna asli (kontras cukup)', () => {
    expect(fitLogo(BANK_LOGOS.bca.svg, LIGHT_CARD, '#0A0A0A', 'brand')).toBe(BANK_LOGOS.bca.svg);
  });
  it('bagian putih di dalam logo jadi warna kartu (potongan tetap terbaca, tidak menggumpal)', () => {
    const out = monoSvg(BANK_LOGOS.gopay.svg, '#00222B', '#00AED6');
    const body = out.replace(/<clipPath[\s\S]*?<\/clipPath>/g, '');
    expect(body).toContain('fill="#00AED6"');
    expect(body).not.toMatch(/fill="#fff"/i);
  });
  it('logo kartu bank berlatar transparan: SVG tidak menggambar persegi putih (putih hanya di clipPath)', () => {
    for (const l of Object.values(BANK_LOGOS)) {
      const body = l.svg.replace(/<clipPath[\s\S]*?<\/clipPath>/g, '');
      expect(body.match(/<path fill="#fff" d="M0 0h[\d.]+v[\d.]+H0z"\/>/)).toBeNull();
    }
  });
  it('logo jaringan: warna asli; hanya logo satu warna yang gagal kontras jadi tinta kartu (Visa biru di kartu BCA -> putih)', () => {
    expect(fitLogo(SCHEME_LOGOS.mastercard!.svg, BCA_CARD, '#FFFFFF', 'mark')).toBe(SCHEME_LOGOS.mastercard!.svg);
    expect(visibleColors(fitLogo(SCHEME_LOGOS.visa!.svg, BCA_CARD, '#FFFFFF', 'mark'))).toEqual([]);
    expect(fitLogo(SCHEME_LOGOS.visa!.svg, LIGHT_CARD, '#0A0A0A', 'mark')).toBe(SCHEME_LOGOS.visa!.svg);
  });
});

describe('CardArt dengan logo', () => {
  it('BCA: logo bank asli (bukan teks), logo Visa, label produk', async () => {
    await wrap(<CardArt bank="bca" width={200} label="Visa Batman" scheme="visa" />);
    expect(screen.getByLabelText('BCA')).toBeTruthy();
    expect(screen.queryByText('BCA')).toBeNull();
    expect(screen.getByLabelText('Visa')).toBeTruthy();
    expect(screen.getByText('Visa Batman')).toBeTruthy();
  });
  it('bank Malaysia/Turki: teks nama bank; troy: teks nama jaringan', async () => {
    await wrap(<CardArt bank="garanti" width={200} label="Bonus Troy" scheme="troy" />);
    expect(screen.getByText('Garanti BBVA')).toBeTruthy();
    expect(screen.getByText('troy')).toBeTruthy();
  });
});
