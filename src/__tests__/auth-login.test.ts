import { authErrorKey } from '@/features/auth/errors';
import { parseFragment } from '@/features/auth/google';
import { makeParticles } from '@/features/intro/BubbleStream';

jest.mock('@/lib/supabase', () => ({ supabase: { auth: {} } }));

describe('login Google: token dari fragment URL', () => {
  it('membaca access_token dan refresh_token, termasuk karakter ter-encode', () => {
    const p = parseFragment('arshif://masuk#access_token=a.b%2Bc&refresh_token=r1&token_type=bearer');
    expect(p.access_token).toBe('a.b+c');
    expect(p.refresh_token).toBe('r1');
  });
  it('URL tanpa fragment = kosong (tidak ada sesi)', () => {
    expect(parseFragment('arshif://masuk?x=1')).toEqual({});
  });
});

describe('error kata sandi → pesan spesifik', () => {
  it('kredensial salah, email sudah terdaftar, kata sandi lemah', () => {
    expect(authErrorKey({ status: 400, code: 'invalid_credentials' }, 'signIn')).toBe('auth.signIn.errorCredentials');
    expect(authErrorKey({ status: 422, code: 'user_already_exists' }, 'signIn')).toBe('auth.signIn.errorExists');
    expect(authErrorKey({ status: 422, code: 'weak_password' }, 'signIn')).toBe('auth.signIn.errorWeak');
  });
});

describe('air mancur gelembung Sambut', () => {
  it('deterministik, keluar lewat tepi atas, dan menyebar ke dua sisi', () => {
    const a = makeParticles(390, 400);
    expect(makeParticles(390, 400)).toEqual(a);
    for (const p of a) expect(p.endY).toBeLessThan(-400);
    expect(a.some((p) => p.endX < -60)).toBe(true);
    expect(a.some((p) => p.endX > 60)).toBe(true);
    // Jeda bergeser: aliran kontinu, bukan semua lahir bersamaan.
    expect(Math.max(...a.map((p) => p.delay)) - Math.min(...a.map((p) => p.delay))).toBeGreaterThan(4000);
  });
});
