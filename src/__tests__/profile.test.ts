import { coverFile, parseCover, presetValue } from '@/lib/cover';
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

describe('sampul profil', () => {
  it('kosong/tak dikenal = tinta, preset dibaca, selain itu foto', () => {
    expect(parseCover(null)).toEqual({ kind: 'preset', key: 'tinta' });
    expect(parseCover('preset:xyz')).toEqual({ kind: 'preset', key: 'tinta' });
    expect(parseCover(presetValue('garis'))).toEqual({ kind: 'preset', key: 'garis' });
    expect(parseCover('u1/a.jpg')).toEqual({ kind: 'photo', path: 'u1/a.jpg' });
  });
  it('hanya foto yang punya berkas untuk dibuang', () => {
    expect(coverFile('u1/a.jpg')).toBe('u1/a.jpg');
    expect(coverFile('preset:batu')).toBeNull();
    expect(coverFile(null)).toBeNull();
  });
});

