import { composite, contrastRatio } from '@/lib/contrast';
import { buildPalette, inkCard, categoryHues, chartArea, palettes, stripTint, type ColorScheme } from '@/theme/tokens';

const schemes: ColorScheme[] = ['dark', 'light'];
const AA_TEXT = 4.5;
const AA_GRAPHIC = 3;

describe.each(schemes)('kontras tema %s', (scheme) => {
  const p = buildPalette(scheme);
  // Latar nyata tempat teks muncul: kanvas, kartu, track segmented/input gelap, sheet, badge abu.
  const backdrops = {
    bg: p.bg,
    surface: p.surface,
    surfaceAlt: p.surfaceAlt,
    surfaceRaised: p.surfaceRaised,
    surfaceSunken: p.surfaceSunken,
    fillOnSurface: composite(p.fill, p.surface),
  };
  const textTokens = {
    text: p.text,
    textSecondary: p.textSecondary,
    textMuted: p.textMuted,
    accentText: p.accentText,
    positive: p.positive,
    negative: p.negative,
    warning: p.warning,
  };

  for (const [bgName, bg] of Object.entries(backdrops)) {
    for (const [fgName, fg] of Object.entries(textTokens)) {
      it(`${fgName} di atas ${bgName} >= 4.5:1`, () => {
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }

  it('teks tombol, chip, segmented tinta (onAccent di atas accent) >= 4.5:1', () => {
    expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each([
    ['text', p.text],
    ['textSecondary', p.textSecondary],
  ])('%s di atas strip akun Home >= 4.5:1', (_, fg) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(p.accent.slice(i, i + 2), 16));
    const strip = composite(`rgba(${r}, ${g}, ${b}, ${stripTint[scheme]})`, p.glassStrong);
    expect(contrastRatio(fg, strip)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('teks di atas tinta aksen (kartu promo, nav terpilih) >= 4.5:1', () => {
    const promo = composite(p.accentSoft, p.surface);
    expect(contrastRatio(p.text, promo)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('garis grafik kekayaan bersih >= 3:1 di kartu', () => {
    const card = composite(palettes[scheme].glass, palettes[scheme].bg);
    expect(contrastRatio(chartArea[scheme].line, card)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });

  it.each(['text', 'textMuted', 'positive', 'negative'] as const)('kartu tinta: %s >= 4.5:1', (key) => {
    expect(contrastRatio(inkCard[scheme][key], inkCard[scheme].bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(['positive', 'negative'] as const)('kartu tinta: badge tren %s di atas tinta soft >= 4.5:1', (key) => {
    const ink = inkCard[scheme];
    const soft = composite(ink[`${key}Soft`], ink.bg);
    expect(contrastRatio(ink[key], soft)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('kartu tinta terbalik: seluruh token palet turunan >= 4.5:1', () => {
    const ink = inkCard[scheme];
    const innerScheme = scheme === 'dark' ? 'light' : 'dark';
    const inner = {
      ...buildPalette(innerScheme),
      bg: ink.bg,
      text: ink.text,
      textSecondary: ink.textMuted,
      textMuted: ink.textMuted,
      accentText: ink.text,
      positive: ink.positive,
      positiveSoft: ink.positiveSoft,
      negative: ink.negative,
      negativeSoft: ink.negativeSoft,
      track: ink.track,
      focus: ink.text,
    };
    for (const key of ['text', 'textSecondary', 'textMuted', 'accentText', 'positive', 'negative', 'warning', 'info'] as const) {
      expect(contrastRatio(inner[key], inner.bg)).toBeGreaterThanOrEqual(AA_TEXT);
    }
    expect(contrastRatio(inner.onAccent, inner.accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(Object.entries(categoryHues[scheme]))('ikon kategori %s >= 3:1 di kaca', (_, color) => {
    const glass = composite(palettes[scheme].glass, palettes[scheme].bg);
    expect(contrastRatio(color, glass)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });
});

describe('composite', () => {
  it('mencampur rgba di atas latar opaque', () => {
    expect(composite('rgba(255, 255, 255, 0.5)', '#000000')).toBe('#808080');
    expect(composite('#123456', '#ffffff')).toBe('#123456');
    expect(() => composite('#000000', 'rgba(0,0,0,0.5)')).toThrow();
  });
});
