import { activeIndex } from '@/components/shell/DesktopNav';

describe('activeIndex (nav desktop)', () => {
  it('menyorot tab dan tab induk layar turunan', () => {
    expect(activeIndex('/')).toBe(0);
    expect(activeIndex('/transaksi')).toBe(1);
    expect(activeIndex('/trx/abc')).toBe(1);
    expect(activeIndex('/rencana/goals')).toBe(2);
    expect(activeIndex('/aset/x')).toBe(3);
    expect(activeIndex('/akun/grup')).toBe(3);
  });
  it('tidak menyorot apa pun di layar tanpa tab induk', () => {
    expect(activeIndex('/pengaturan')).toBe(-1);
    expect(activeIndex('/alat/kurs')).toBe(-1);
  });
});
