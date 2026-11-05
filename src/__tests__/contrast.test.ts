import { composite, contrastRatio, hue } from '@/lib/contrast';
import {
  ACCENT_OPTIONS,
  buildPalette,
  categoryHues,
  palettes,
  type AccentKey,
  type ColorScheme,
} from '@/theme/tokens';

const schemes: ColorScheme[] = ['dark', 'light'];
const accentKeys = ACCENT_OPTIONS.map((a) => a.key);
const AA_TEXT = 4.5;
const AA_GRAPHIC = 3;

/**
 * Latar nyata tempat teks muncul: latar polos, kartu, kaca di atas latar,
 * dan kaca di atas pusat ambient glow (titik terburuk gradasi).
 */
function backdrops(scheme: ColorScheme, accent: AccentKey) {
  const p = buildPalette(scheme, accent);
  const glowBg = composite(p.accentGlow, p.bg);
  return {
    bg: p.bg,
    surface: p.surface,
    glassOnBg: composite(p.glass, p.bg),
    glassOnGlow: composite(p.glass, glowBg),
    glassStrongOnGlow: composite(p.glassStrong, glowBg),
    fallbackOnGlow: composite(p.glassFallback, glowBg),
  };
}

describe.each(schemes)('kontras tema %s', (scheme) => {
  describe.each(accentKeys)('aksen %s', (accent) => {
    const p = buildPalette(scheme, accent);
    const textTokens = {
      text: p.text,
      textSecondary: p.textSecondary,
      textMuted: p.textMuted,
      accentText: p.accentText,
      positive: p.positive,
      negative: p.negative,
      warning: p.warning,
    };

    for (const [bgName, bg] of Object.entries(backdrops(scheme, accent))) {
      for (const [fgName, fg] of Object.entries(textTokens)) {
        it(`${fgName} di atas ${bgName} >= 4.5:1`, () => {
          expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
        });
      }
    }

    it('teks tombol (onAccent di atas accent) >= 4.5:1', () => {
      expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    // Di atas glow polos hanya ada judul, label, dan teks aksen (header + saldo).
    const glowBg = composite(p.accentGlow, p.bg);
    it.each([
      ['text', p.text],
      ['textSecondary', p.textSecondary],
      ['textMuted', p.textMuted],
      ['accentText', p.accentText],
    ])('%s di atas puncak glow >= 4.5:1', (_, fg) => {
      expect(contrastRatio(fg, glowBg)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('teks aksen di atas tinta aksen (kartu promo) >= 4.5:1', () => {
      const promo = composite(p.accentSoft, backdrops(scheme, accent).glassOnGlow);
      expect(contrastRatio(p.text, promo)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(p.accentText, promo)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  it('aksen Merah: over budget memakai rona berbeda (>= 15°) dari aksen', () => {
    const p = buildPalette(scheme, 'merah');
    const diff = Math.abs(hue(p.negative) - hue(p.accentText));
    expect(Math.min(diff, 360 - diff)).toBeGreaterThanOrEqual(15);
    expect(p.negative).not.toBe(palettes[scheme].negative);
  });

  it('aksen selain Merah: over budget tetap merah bawaan', () => {
    expect(buildPalette(scheme, 'biru').negative).toBe(palettes[scheme].negative);
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
