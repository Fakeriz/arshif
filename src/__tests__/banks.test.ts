import { BANKS } from '@/constants/banks';
import { contrastRatio } from '@/lib/contrast';

describe('kartu per bank', () => {
  it.each(BANKS.map((b) => [b.name, b.color, b.onColor]))('teks di kartu %s >= 4.5:1', (_, color, onColor) => {
    expect(contrastRatio(onColor, color)).toBeGreaterThanOrEqual(4.5);
  });

  it('kunci bank unik', () => {
    expect(new Set(BANKS.map((b) => b.key)).size).toBe(BANKS.length);
  });
});
