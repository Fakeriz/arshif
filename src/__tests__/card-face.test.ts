import { BANKS } from '@/constants/banks';
import {
  cardGradient,
  cardPhotoFile,
  cleanExpiry,
  cleanHolder,
  cleanLast4,
  FINISH_PALETTE,
  formatCardStyle,
  hasChip,
  parseCardStyle,
  patternFor,
  photoCardStyle,
  resolveCardColors,
  shade,
  showsChipOnFace,
} from '@/lib/cardFace';

describe('wajah kartu', () => {
  it('motif: pilihan pengguna, atau bawaan jenis akun bila kosong/id katalog lama', () => {
    expect(patternFor('tabungan')).toBe('rings');
    expect(patternFor('emoney')).toBe('circuit');
    expect(patternFor('kartu_kredit', 'bca-credit-visa-batman')).toBe('waves');
    expect(patternFor('cash', 'grid')).toBe('grid');
    expect(patternFor('kartu_kredit', 'obsidian:guilloche')).toBe('guilloche');
  });

  it('parseCardStyle & formatCardStyle: motif polos, finish material, foto pribadi, dan fallback aman', () => {
    expect(parseCardStyle('tabungan')).toEqual({ kind: 'art', finish: 'bank', pattern: 'rings' });
    expect(parseCardStyle('emoney')).toEqual({ kind: 'art', finish: 'bank', pattern: 'circuit' });
    expect(parseCardStyle('kartu_kredit', 'bca-credit-visa-batman')).toEqual({ kind: 'art', finish: 'bank', pattern: 'waves' });
    expect(parseCardStyle('kartu_kredit', 'obsidian:guilloche')).toEqual({ kind: 'art', finish: 'obsidian', pattern: 'guilloche' });
    expect(parseCardStyle('tabungan', 'titanium:rings')).toEqual({ kind: 'art', finish: 'titanium', pattern: 'rings' });
    expect(parseCardStyle('cash', 'monokrom:halftone')).toEqual({ kind: 'art', finish: 'monokrom', pattern: 'halftone' });
    expect(parseCardStyle('emoney', 'photo:u1/x.jpg')).toEqual({ kind: 'photo', path: 'u1/x.jpg' });
    expect(parseCardStyle('emoney', 'bad:guilloche')).toEqual({ kind: 'art', finish: 'bank', pattern: 'circuit' });

    expect(formatCardStyle('bank', 'kawung')).toBe('kawung');
    expect(formatCardStyle('obsidian', 'guilloche')).toBe('obsidian:guilloche');
    expect(formatCardStyle('titanium', 'rings')).toBe('titanium:rings');
    expect(formatCardStyle('monokrom', 'halftone')).toBe('monokrom:halftone');

    expect(photoCardStyle('u1/x.jpg')).toBe('photo:u1/x.jpg');
    expect(cardPhotoFile('photo:u1/x.jpg')).toBe('u1/x.jpg');
    expect(cardPhotoFile('obsidian:guilloche')).toBeNull();
    expect(cardPhotoFile(null)).toBeNull();
  });

  it('chip & warna kartu sesuai jenis akun, Flazz, finish, dan foto pribadi', () => {
    const artBank = parseCardStyle('emoney', 'circuit');
    const photo = parseCardStyle('tabungan', 'photo:u1/card.jpg');
    expect(hasChip('emoney')).toBe(false);
    expect(showsChipOnFace('emoney', 'flazz', artBank)).toBe(true);
    expect(showsChipOnFace('emoney', 'mandiri', artBank)).toBe(false);
    expect(showsChipOnFace('tabungan', 'bca', photo)).toBe(false);
    expect(resolveCardColors('#0060AF', '#FFFFFF', parseCardStyle('kartu_kredit', 'obsidian:guilloche'))).toEqual({
      color: FINISH_PALETTE.obsidian.color,
      onColor: FINISH_PALETTE.obsidian.onColor,
      chipTone: 'silver',
    });
    expect(resolveCardColors('#0060AF', '#FFFFFF', photo)).toEqual({
      color: '#181A1F',
      onColor: '#FFFFFF',
      chipTone: 'silver',
    });
  });

  it('gradasi dari warna bank: terang, asli, gelap', () => {
    expect(shade('#000000', 0.5)).toBe('#808080');
    expect(shade('#ffffff', -1)).toBe('#000000');
    // Teks putih: makin gelap; teks hitam: makin terang. Titik pertama = warna bank.
    const [a, , c] = cardGradient('#0060AF', '#FFFFFF');
    expect(a).toBe('#0060AF');
    expect(c < a).toBe(true);
    expect(cardGradient('#FFB800', '#0A0A0A')[2] > '#FFB800').toBe(true);
  });

  it('validasi detail kartu', () => {
    expect(cleanLast4('48 21')).toBe('4821');
    expect(cleanLast4('482')).toBeNull();
    expect(cleanHolder('  maya   lestari ')).toBe('MAYA LESTARI');
    expect(cleanHolder('   ')).toBeNull();
    expect(cleanHolder('a'.repeat(41))).toBeNull();
    expect(cleanExpiry('9/29')).toBe('09/29');
    expect(cleanExpiry('0929')).toBe('09/29');
    expect(cleanExpiry('13/29')).toBeNull();
    expect(cleanExpiry('00/29')).toBeNull();
  });
});

// Kontras teks kartu terhadap SEMUA titik gradasi, untuk setiap bank dan finish material (WCAG AA 4.5:1).
const lum = (h: string) => {
  const n = parseInt(h.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4))
    .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i]!, 0);
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

it('teks kartu >= 4.5:1 di seluruh gradasi untuk setiap bank', () => {
  const fails = BANKS.flatMap((b) =>
    cardGradient(b.color, b.onColor)
      .filter((stop) => ratio(b.onColor, stop) < 4.5)
      .map((stop) => `${b.key} ${stop}`),
  );
  expect(fails).toEqual([]);
});

it('teks kartu >= 4.5:1 di seluruh gradasi untuk setiap material finish', () => {
  const fails = Object.entries(FINISH_PALETTE).flatMap(([key, p]) =>
    cardGradient(p.color, p.onColor)
      .filter((stop) => ratio(p.onColor, stop) < 4.5)
      .map((stop) => `${key} ${stop}`),
  );
  expect(fails).toEqual([]);
});
