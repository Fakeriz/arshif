import { toBase64 } from '@/lib/base64';

// Pembanding dari Node (tanpa @types/node).
declare const Buffer: { from(v: string | Uint8Array, enc?: string): { toString(enc: string): string } };

const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe('base64 untuk audio Voice Log', () => {
  it.each(['', 'a', 'ab', 'abc', 'abcd', 'Arshif Voice Log 2026', 'çğıöşü'])('sama dengan Buffer untuk %p', (s) => {
    expect(toBase64(bytes(s))).toBe(Buffer.from(s, 'utf8').toString('base64'));
  });

  it('semua nilai byte 0–255', () => {
    const all = new Uint8Array(256).map((_, i) => i);
    expect(toBase64(all.buffer)).toBe(Buffer.from(all).toString('base64'));
  });
});
