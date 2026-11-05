import { contrastRatio } from '@/lib/contrast';
import { categoryHues, palettes, type ColorScheme } from '@/theme/tokens';

const schemes: ColorScheme[] = ['dark', 'light'];
const AA_TEXT = 4.5;
const AA_GRAPHIC = 3;

describe.each(schemes)('kontras token (%s)', (scheme) => {
  const p = palettes[scheme];
  const backgrounds = { bg: p.bg, surface: p.surface, surfaceRaised: p.surfaceRaised };
  const textTokens = {
    text: p.text,
    textSecondary: p.textSecondary,
    textMuted: p.textMuted,
    accentText: p.accentText,
    positive: p.positive,
    negative: p.negative,
    warning: p.warning,
    info: p.info,
  };

  for (const [bgName, bg] of Object.entries(backgrounds)) {
    for (const [fgName, fg] of Object.entries(textTokens)) {
      it(`${fgName} di atas ${bgName} >= AA (4.5:1)`, () => {
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }

  it('teks tombol primary (onAccent di atas accent) >= AA', () => {
    expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('accent sebagai elemen grafis di atas surface >= 3:1', () => {
    expect(contrastRatio(p.accent, p.surface)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });

  it.each(Object.entries(categoryHues[scheme]))('ikon kategori %s >= 3:1 di surface', (_, hue) => {
    expect(contrastRatio(hue, p.surface)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });
});
