/**
 * Desain kartu per bank (FR-ACC-2): warna khas + nama bank sebagai teks, TANPA logo resmi.
 * Warna adalah perkiraan warna merek; verifikasi ke panduan merek resmi sebelum rilis.
 * `onColor` dipilih agar teks di atas kartu >= 4.5:1 (diuji di __tests__/banks.test.ts).
 */
export type BankDef = { key: string; name: string; color: string; onColor: string; country: 'ID' | 'MY' | 'TR' | 'ANY' };

export const BANKS: BankDef[] = [
  { key: 'bca', name: 'BCA', color: '#0060AF', onColor: '#FFFFFF', country: 'ID' },
  { key: 'mandiri', name: 'Mandiri', color: '#003D79', onColor: '#FFFFFF', country: 'ID' },
  { key: 'bri', name: 'BRI', color: '#00529C', onColor: '#FFFFFF', country: 'ID' },
  { key: 'bni', name: 'BNI', color: '#006885', onColor: '#FFFFFF', country: 'ID' },
  { key: 'jago', name: 'Jago', color: '#FFB800', onColor: '#1A1300', country: 'ID' },
  { key: 'gopay', name: 'GoPay', color: '#00AED6', onColor: '#00222B', country: 'ID' },
  { key: 'ovo', name: 'OVO', color: '#4C3494', onColor: '#FFFFFF', country: 'ID' },
  { key: 'dana', name: 'DANA', color: '#118EEA', onColor: '#031B2E', country: 'ID' },
  { key: 'maybank', name: 'Maybank', color: '#FFC83D', onColor: '#1A1300', country: 'MY' },
  { key: 'cimb', name: 'CIMB', color: '#C8102E', onColor: '#FFFFFF', country: 'MY' },
  { key: 'garanti', name: 'Garanti BBVA', color: '#00704A', onColor: '#FFFFFF', country: 'TR' },
  { key: 'cash', name: 'Tunai', color: '#3A3631', onColor: '#FFFFFF', country: 'ANY' },
];

const byKey = new Map(BANKS.map((b) => [b.key, b]));

export function getBank(key: string): BankDef {
  return byKey.get(key) ?? byKey.get('cash')!;
}
