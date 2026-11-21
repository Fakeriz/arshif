import { cleanName, initialsOf, profileName } from '@/lib/profile';

describe('profil', () => {
  it('nama jatuh ke email bila kosong', () => {
    expect(profileName('  Rani  ', 'x@y.z')).toBe('Rani');
    expect(profileName(null, 'rani.pratiwi@example.com')).toBe('rani.pratiwi');
    expect(profileName('', '')).toBe('');
  });
  it('inisial maks 2 huruf', () => {
    expect(initialsOf('rani.pratiwi')).toBe('RP');
    expect(initialsOf('Ahmad bin Ismail Yusof')).toBe('AB');
    expect(initialsOf('')).toBe('');
  });
  it('nama dirapikan, kosong = null, >80 ditolak', () => {
    expect(cleanName('  Rani   Pratiwi ')).toBe('Rani Pratiwi');
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('a'.repeat(81))).toBe('too_long');
    expect(cleanName('a'.repeat(80))).toBe('a'.repeat(80));
  });
});
