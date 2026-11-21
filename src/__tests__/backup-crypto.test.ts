import { BackupError, decryptBackup, encryptBackup, formatRecoveryKey, newBackupKey, parseRecoveryKey, readBackupHeader } from '@/lib/backup/crypto';

const enc = (s: string) => new TextEncoder().encode(s);
const header = { createdAt: '2026-11-21T03:00:00.000Z', receipts: true };

describe('enkripsi cadangan (AES-256-GCM)', () => {
  it('bolak-balik: isi dan header kembali utuh; isi tidak tersimpan polos di file', () => {
    const key = newBackupKey();
    const file = encryptBackup(key, header, enc('{"transactions":[{"merchant":"Indomaret"}]}'));
    expect(new TextDecoder().decode(file)).not.toContain('Indomaret');
    const out = decryptBackup(key, file);
    expect(out.header).toEqual(header);
    expect(new TextDecoder().decode(out.plaintext)).toContain('Indomaret');
    expect(readBackupHeader(file)).toEqual(header);
  });

  it('kunci salah, isi diubah, atau header diubah = ditolak', () => {
    const key = newBackupKey();
    const file = encryptBackup(key, header, enc('rahasia'));
    expect(() => decryptBackup(newBackupKey(), file)).toThrow(BackupError);
    const flipped = file.slice();
    flipped[flipped.length - 1] ^= 1;
    expect(() => decryptBackup(key, flipped)).toThrow(BackupError);
    const head = file.slice();
    head[14] ^= 1; // byte di dalam header JSON
    expect(() => decryptBackup(key, head)).toThrow(BackupError);
  });

  it('bukan file cadangan = not_backup', () => {
    expect(() => readBackupHeader(enc('PK zip lain'))).toThrow(expect.objectContaining({ code: 'not_backup' }));
  });
});

describe('kunci pemulihan', () => {
  it('52 karakter, 13 grup; dibaca ulang sama persis', () => {
    const key = newBackupKey();
    const text = formatRecoveryKey(key);
    expect(text.split('-')).toHaveLength(13);
    expect(text.replace(/-/g, '')).toHaveLength(52);
    expect(parseRecoveryKey(text)).toEqual(key);
  });

  it('huruf kecil, spasi, O/I/L yang tertukar diterima; panjang salah atau huruf asing ditolak', () => {
    const key = new Uint8Array(32).fill(7);
    const text = formatRecoveryKey(key);
    const sloppy = text.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
    expect(parseRecoveryKey(sloppy)).toEqual(key);
    expect(parseRecoveryKey(text.slice(0, -1))).toBeNull();
    expect(parseRecoveryKey(text.replace(/.$/, 'U'))).toBeNull();
  });
});

import { fromBase64, toBase64 } from '@/lib/base64';
import { parsePayload } from '@/lib/backup/data';
import { backupDue } from '@/features/backup/service';

describe('isi cadangan', () => {
  it('base64 bolak-balik untuk biner acak (semua panjang sisa)', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 255, 1000]) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 255);
      expect(fromBase64(toBase64(bytes.buffer))).toEqual(bytes);
    }
  });

  it('isi rusak atau versi lain ditolak; isi sah diterima', () => {
    expect(parsePayload('bukan json')).toBeNull();
    expect(parsePayload(JSON.stringify({ v: 2, profile: {}, tables: {}, receipts: {} }))).toBeNull();
    expect(parsePayload(JSON.stringify({ v: 1, profile: {}, tables: { accounts: 'x' }, receipts: {} }))).toBeNull();
    expect(parsePayload(JSON.stringify({ v: 1, profile: { payday: 25 }, tables: { accounts: [{ id: 'a' }] }, receipts: {} }))?.tables.accounts).toHaveLength(1);
  });
});

describe('pengingat cadangan', () => {
  const day = 86_400_000;
  const now = Date.parse('2026-11-21T00:00:00Z');
  it('mati = tidak pernah jatuh tempo; belum pernah = jatuh tempo; lewat N hari = jatuh tempo', () => {
    expect(backupDue({ lastAt: null, everyDays: 0 }, now)).toBe(false);
    expect(backupDue({ lastAt: null, everyDays: 7 }, now)).toBe(true);
    expect(backupDue({ lastAt: new Date(now - 6 * day).toISOString(), everyDays: 7 }, now)).toBe(false);
    expect(backupDue({ lastAt: new Date(now - 7 * day).toISOString(), everyDays: 7 }, now)).toBe(true);
    expect(backupDue({ lastAt: new Date(now - 20 * day).toISOString(), everyDays: 30 }, now)).toBe(false);
  });
});
