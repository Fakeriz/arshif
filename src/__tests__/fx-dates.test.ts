import { DEMO_TODAY, addDays, dayLabel, dayLong, daysInMonth, diffDays, weekday } from '@/lib/dates';
import { convert, crossRate } from '@/lib/fx';

describe('kurs silang lewat USD', () => {
  it('tanpa float, 12 desimal', () => {
    expect(crossRate('IDR', 'USD')).toBe('0.000061538461');
    expect(crossRate('USD', 'IDR')).toBe('16250.000000000000');
    expect(crossRate('MYR', 'MYR')).toBe('1');
  });

  it('konversi antar minor units', () => {
    expect(convert(16250, 'IDR', 'USD')).toBe(100);
    expect(convert(100, 'USD', 'IDR')).toBe(16250);
    expect(convert(428, 'MYR', 'USD')).toBe(100);
    expect(convert(64_750, 'TRY', 'MYR')).toBe(6371);
    expect(convert(123, 'IDR', 'IDR')).toBe(123);
  });

  it('mata uang tanpa kurs ditolak, bukan ditebak', () => {
    expect(() => crossRate('IDR', 'XYZ')).toThrow('Kurs tidak tersedia untuk XYZ');
  });
});

describe('tanggal', () => {
  it('menghitung selisih hari dan lintas bulan/tahun', () => {
    expect(diffDays('2026-11-05', '2026-10-25')).toBe(11);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it('hari dalam seminggu dan label', () => {
    expect(weekday('2026-11-05')).toBe(4); // Kamis
    expect(dayLong('2026-11-05')).toBe('Kamis, 5 November 2026');
    expect(dayLabel('2026-11-05', DEMO_TODAY)).toBe('Hari ini');
    expect(dayLabel('2026-11-04', DEMO_TODAY)).toBe('Kemarin');
    expect(dayLabel('2026-10-29', DEMO_TODAY)).toBe('29 Okt');
    expect(dayLabel('2025-12-31', DEMO_TODAY)).toBe('31 Des 2025');
  });

  it('menolak format tanggal yang salah', () => {
    expect(() => diffDays('5-11-2026', '2026-11-05')).toThrow();
  });
});
