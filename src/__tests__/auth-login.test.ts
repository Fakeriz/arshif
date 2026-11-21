import { authErrorKey } from '@/features/auth/errors';
import { parseFragment } from '@/features/auth/google';
import { layoutBubbles } from '@/features/intro/BubbleField';

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

describe('gelembung Sambut', () => {
  it('susunan tetap sama, tidak keluar area, dan tidak menempel di tombol', () => {
    const a = layoutBubbles(360, 320);
    expect(layoutBubbles(360, 320)).toEqual(a);
    for (const b of a) {
      expect(Math.abs(b.x) + b.size / 2).toBeLessThanOrEqual(180);
      expect(b.y).toBeLessThanOrEqual(-40);
      expect(b.y - b.size / 2).toBeGreaterThanOrEqual(-320);
    }
  });
});
