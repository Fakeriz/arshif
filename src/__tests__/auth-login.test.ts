import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';

import { makeDevicePref } from '@/features/home/devicePref';
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

describe('sapaan Beranda', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const g = require('@/features/home/greeting') as typeof import('@/features/home/greeting');
  it('jam → waktu, termasuk dini hari', () => {
    expect([2, 6, 12, 16, 21].map(g.slotOf)).toEqual(['late', 'morning', 'afternoon', 'evening', 'night']);
  });
  it('gajian hari ini, 1-2 hari lagi, akhir pekan siang, malam akhir pekan tetap malam', () => {
    expect(g.contextOf(new Date(2026, 10, 25, 9), 25)).toBe('payday');
    expect(g.contextOf(new Date(2026, 10, 23, 9), 25)).toBe('paydaySoon');
    expect(g.daysToPayday(new Date(2026, 10, 30, 9), 1)).toBe(1); // lintas bulan
    expect(g.contextOf(new Date(2026, 10, 21, 12), 25)).toBe('weekend'); // Sabtu
    expect(g.contextOf(new Date(2026, 10, 21, 21), 25)).toBe('night');
  });
  it('stabil dalam sehari, berganti di hari lain; judul tanpa nama tidak memuat {name}', () => {
    const t = (k: string) => (k.startsWith('home.hello') ? 'Selamat pagi|Pagi, {name}|Halo, {name}' : 'a|b|c');
    const a = g.greetingLines(t as never, new Date(2026, 10, 20, 8), 25, 'Ahmad Fauzi');
    expect(g.greetingLines(t as never, new Date(2026, 10, 20, 9, 30), 25, 'Ahmad Fauzi')).toEqual(a);
    const week = new Set(Array.from({ length: 7 }, (_, i) => g.greetingLines(t as never, new Date(2026, 10, 10 + i, 8), 25, 'Ahmad').nudge));
    expect(week.size).toBeGreaterThan(1);
    expect(g.greetingLines(t as never, new Date(2026, 10, 20, 8), 25, '').title).toBe('Selamat pagi');
    expect(a.title).not.toContain('Fauzi');
  });
});

describe('preferensi perangkat Beranda', () => {
  it('membaca nilai lama (teks mentah) maupun JSON', async () => {
    await AsyncStorage.setItem('t.raw', 'garis');
    await AsyncStorage.setItem('t.json', 'false');
    const useRaw = makeDevicePref<string>('t.raw', 'plain', (v): v is string => typeof v === 'string');
    const useBool = makeDevicePref<boolean>('t.json', true, (v): v is boolean => typeof v === 'boolean');
    const a = await renderHook(() => useRaw());
    const b = await renderHook(() => useBool());
    await waitFor(() => expect(a.result.current[0]).toBe('garis'));
    await waitFor(() => expect(b.result.current[0]).toBe(false));
  });
});
