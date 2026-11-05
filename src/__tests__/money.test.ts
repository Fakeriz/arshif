import {
  convertMinor,
  currencyMeta,
  formatCompact,
  formatMoney,
  formatNumber,
  formatTypedAmount,
  parseAmountInput,
  rateToScaled,
} from '@/lib/money';

describe('formatMoney — format sesuai PRD', () => {
  it.each([
    [45000, 'IDR', 'Rp 45.000'],
    [1250, 'MYR', 'RM 12.50'],
    [35000, 'TRY', '₺350,00'],
    [999, 'USD', '$9.99'],
    [12500000, 'IDR', 'Rp 12.500.000'],
    [123456789, 'MYR', 'RM 1,234,567.89'],
    [5, 'USD', '$0.05'],
    [0, 'IDR', 'Rp 0'],
  ])('%d %s → %s', (minor, code, expected) => {
    expect(formatMoney(minor, code)).toBe(expected);
  });

  it('pengeluaran memakai tanda minus tipografis, pemasukan "+" saat diminta', () => {
    expect(formatMoney(-45000, 'IDR')).toBe('−Rp 45.000');
    expect(formatMoney(45000, 'IDR', 'always')).toBe('+Rp 45.000');
    expect(formatMoney(-45000, 'IDR', 'never')).toBe('Rp 45.000');
    expect(formatMoney(0, 'IDR', 'always')).toBe('Rp 0');
  });

  it('mata uang tak dikenal jatuh ke kode ISO', () => {
    expect(formatMoney(1050, 'CHF')).toBe('CHF 10.50');
    expect(currencyMeta('chf').exponent).toBe(2);
  });

  it('menolak nominal float', () => {
    expect(() => formatMoney(10.5, 'USD')).toThrow();
    expect(() => formatNumber(Number.NaN, 'IDR')).toThrow();
  });
});

describe('formatCompact', () => {
  it.each([
    [1200000, 'IDR', '1,2 jt'],
    [450000, 'IDR', '450 rb'],
    [3000000000, 'IDR', '3 M'],
    [1250000, 'USD', '12.5k'],
    [-2000000, 'IDR', '−2 jt'],
    [900, 'IDR', '900'],
  ])('%d %s → %s', (minor, code, expected) => {
    expect(formatCompact(minor, code)).toBe(expected);
  });
});

describe('parseAmountInput', () => {
  it.each([
    ['45.000', 'IDR', 45000],
    ['45000', 'IDR', 45000],
    ['Rp 1.250.000', 'IDR', 1250000],
    ['12.50', 'MYR', 1250],
    ['12,5', 'MYR', 1250],
    ['1,234.56', 'MYR', 123456],
    ['1.234,56', 'TRY', 123456],
    ['350', 'TRY', 35000],
    ['1,000', 'USD', 100000],
    ['0.99', 'USD', 99],
  ])('"%s" %s → %d', (text, code, expected) => {
    expect(parseAmountInput(text, code)).toBe(expected);
  });

  it.each(['', 'abc', '.,'])('input tidak valid "%s" → null', (text) => {
    expect(parseAmountInput(text, 'IDR')).toBeNull();
  });

  it('menolak angka di luar batas aman', () => {
    expect(parseAmountInput('99999999999999999999', 'IDR')).toBeNull();
  });
});

describe('convertMinor — tanpa float', () => {
  it('USD → IDR memakai kurs desimal string', () => {
    // $10.00 × 15873.45 = Rp 158.734,5 → dibulatkan Rp 158.735
    expect(convertMinor(1000, 'USD', 'IDR', '15873.45')).toBe(158735);
  });

  it('IDR → MYR menghasilkan sen', () => {
    // Rp 100.000 × 0.000287 = RM 28.70
    expect(convertMinor(100000, 'IDR', 'MYR', '0.000287')).toBe(2870);
  });

  it('TRY → USD dengan pembulatan half-away-from-zero', () => {
    expect(convertMinor(100, 'TRY', 'USD', '0.025')).toBe(3); // 0.025 → 0.03
    expect(convertMinor(-100, 'TRY', 'USD', '0.025')).toBe(-3);
  });

  it('kurs identitas mempertahankan nilai', () => {
    expect(convertMinor(123456, 'MYR', 'MYR', '1')).toBe(123456);
  });

  it('presisi kurs sampai 12 desimal', () => {
    expect(rateToScaled('0.000000000001')).toBe(BigInt(1));
    expect(() => rateToScaled('-1')).toThrow();
    expect(() => rateToScaled('abc')).toThrow();
  });
});

describe('formatTypedAmount — tampilan saat mengetik', () => {
  it.each([
    ['45000', 'IDR', false, '45.000'],
    ['1234567', 'IDR', false, '1.234.567'],
    ['007', 'IDR', false, '7'],
    ['1234', 'MYR', false, '1,234'],
    ['1,23', 'MYR', false, '123'], // hapus digit dari "1,234" tetap bilangan bulat
    ['1,234.', 'MYR', true, '1,234.'],
    ['1,234,', 'MYR', true, '1,234.'], // keyboard koma → desimal MYR
    ['12.345', 'MYR', false, '12.34'], // maksimal 2 desimal
    ['350,5', 'TRY', false, '350,5'],
    ['1.000', 'IDR', true, '1.000'], // IDR tanpa desimal
    ['', 'IDR', false, ''],
  ])('"%s" %s → "%s"', (typed, code, sep, expected) => {
    expect(formatTypedAmount(typed, code, sep)).toBe(expected);
  });

  it('hasil tampilan selalu bisa di-parse kembali dengan benar', () => {
    // koma = pemisah ribuan MYR → "12,345" = RM 12,345.00
    expect(parseAmountInput(formatTypedAmount('1234,5', 'MYR', false), 'MYR')).toBe(1234500);
    expect(parseAmountInput(formatTypedAmount('1234.5', 'MYR', false), 'MYR')).toBe(123450);
    expect(parseAmountInput(formatTypedAmount('1234', 'TRY', false), 'TRY')).toBe(123400);
  });
});
