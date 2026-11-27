import type { Account, Transaction } from '@/data/types';
import { fromBase64 } from '@/lib/base64';
import {
  BackupError,
  decryptBackup,
  encryptBackup,
  formatRecoveryKey,
  newBackupKey,
  parseRecoveryKey,
  readBackupHeader,
} from '@/lib/backup/crypto';
import { similarity } from '@/lib/dedupe';
import { crossRate, MissingRateError, SAMPLE_USD_RATES, setUsdRates, tryConvertMajor } from '@/lib/fx';
import { convertMinor, parseAmountInput, rateToScaled } from '@/lib/money';
import { ensureRustCoreReady, getRustCoreStatus, setRustCoreModeForTests } from '@/lib/rust';
import { WASM_BASE64, WASM_BYTE_LENGTH } from '@/lib/rust/wasmArtifact';
import { parseAmount, parseNotification } from '@/lib/smartlog/parser';
import { reconcileStatement } from '@/lib/statement';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

function runInBoth<T>(fn: () => T): { wasm: T; ts: T } {
  setRustCoreModeForTests('wasm');
  const wasm = fn();
  setRustCoreModeForTests('ts-fallback');
  const ts = fn();
  setRustCoreModeForTests('auto');
  return { wasm, ts };
}

afterEach(() => {
  setRustCoreModeForTests('auto');
  setUsdRates(SAMPLE_USD_RATES, '2026-11-05');
});

describe('arshif-core hybrid Rust WASM runtime', () => {
  it('activates compiled Rust WASM synchronously in Node/Jest with zero host imports', async () => {
    const status = getRustCoreStatus();
    expect(status.activeBackend).toBe('wasm');
    expect(status.wasmReady).toBe(true);
    expect(status.wasmBytes).toBeGreaterThan(0);
    expect(status.wasmBytes).toBe(WASM_BYTE_LENGTH);
    await expect(ensureRustCoreReady()).resolves.toBe('wasm');

    const raw = fromBase64(WASM_BASE64);
    const exact = new Uint8Array(raw.byteLength);
    exact.set(raw);
    const mod = new WebAssembly.Module(exact.buffer);
    expect(WebAssembly.Module.imports(mod)).toEqual([]);

    setRustCoreModeForTests('ts-fallback');
    expect(getRustCoreStatus().activeBackend).toBe('ts-fallback');
    await expect(ensureRustCoreReady()).resolves.toBe('ts-fallback');
  });
});

describe('differential parity: backup crypto (.arshif v1 AES-256-GCM + Crockford Base32)', () => {
  const header = { createdAt: '2026-11-27T12:34:56.000Z', receipts: true };

  it('cross-engine compatibility: WASM encrypt -> TS decrypt and TS encrypt -> WASM decrypt', () => {
    const key = newBackupKey();
    const payload = enc(JSON.stringify({ v: 1, merchant: 'Kopi Kenangan ☕️', amount: 45000 }));

    setRustCoreModeForTests('wasm');
    const wasmFile = encryptBackup(key, header, payload);
    setRustCoreModeForTests('ts-fallback');
    const tsDecoded = decryptBackup(key, wasmFile);
    expect(tsDecoded.header).toEqual(header);
    expect(dec(tsDecoded.plaintext)).toBe(dec(payload));

    const tsFile = encryptBackup(key, header, payload);
    setRustCoreModeForTests('wasm');
    const wasmDecoded = decryptBackup(key, tsFile);
    expect(wasmDecoded.header).toEqual(header);
    expect(dec(wasmDecoded.plaintext)).toBe(dec(payload));
  });

  it('handles 256 KB binary payloads cleanly across WASM and TS fallback', () => {
    const key = newBackupKey();
    const large = new Uint8Array(256 * 1024);
    for (let i = 0; i < large.length; i++) large[i] = (i * 131 + 17) & 255;

    setRustCoreModeForTests('wasm');
    const sealed = encryptBackup(key, header, large);
    const openedWasm = decryptBackup(key, sealed);
    expect(openedWasm.plaintext).toEqual(large);

    setRustCoreModeForTests('ts-fallback');
    const openedTs = decryptBackup(key, sealed);
    expect(openedTs.plaintext).toEqual(large);
  });

  it('produces identical BackupError codes for not_backup, version, corrupt, and bad_key', () => {
    const key = newBackupKey();
    const wrongKey = newBackupKey();
    setRustCoreModeForTests('wasm');
    const validFile = encryptBackup(key, header, enc('secret'));

    const notBackup = enc('NOT_ARSHIF_FILE');

    const badVersion = validFile.slice();
    badVersion[8] = 99;

    const truncated = validFile.slice(0, 20);

    const invalidJsonHeader = validFile.slice();
    // Corrupt JSON braces inside header while keeping length valid
    invalidJsonHeader[13] = 0x58; // 'X' instead of '{'

    const badTag = validFile.slice();
    badTag[badTag.length - 1] ^= 0xff;

    const cases: [string, () => unknown, BackupError['code']][] = [
      ['not_backup', () => readBackupHeader(notBackup), 'not_backup'],
      ['version', () => readBackupHeader(badVersion), 'version'],
      ['corrupt (truncated)', () => readBackupHeader(truncated), 'corrupt'],
      ['corrupt (invalid json)', () => decryptBackup(key, invalidJsonHeader), 'corrupt'],
      ['bad_key (wrong key)', () => decryptBackup(wrongKey, validFile), 'bad_key'],
      ['bad_key (tampered tag)', () => decryptBackup(key, badTag), 'bad_key'],
    ];

    for (const [, fn, expectedCode] of cases) {
      for (const mode of ['wasm', 'ts-fallback'] as const) {
        setRustCoreModeForTests(mode);
        let caught: unknown;
        try {
          fn();
        } catch (err) {
          caught = err;
        }
        expect(caught).toBeInstanceOf(BackupError);
        expect((caught as BackupError).code).toBe(expectedCode);
      }
    }
  });

  it('matches Crockford Base32 formatRecoveryKey and parseRecoveryKey byte-for-byte', () => {
    const keys = [
      new Uint8Array(32).fill(0),
      new Uint8Array(32).fill(255),
      Uint8Array.from({ length: 32 }, (_, i) => (i * 29 + 3) & 255),
      newBackupKey(),
    ];
    for (const key of keys) {
      const formatted = runInBoth(() => formatRecoveryKey(key));
      expect(formatted.wasm).toBe(formatted.ts);

      const parsed = runInBoth(() => parseRecoveryKey(formatted.wasm));
      expect(parsed.wasm).toEqual(key);
      expect(parsed.wasm).toEqual(parsed.ts);

      const sloppy = formatted.wasm.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'i');
      const parsedSloppy = runInBoth(() => parseRecoveryKey(sloppy));
      expect(parsedSloppy.wasm).toEqual(key);
      expect(parsedSloppy.wasm).toEqual(parsedSloppy.ts);
    }

    for (const bad of ['', 'SHORT', '0'.repeat(53), `${'0'.repeat(51)}U`]) {
      const res = runInBoth(() => parseRecoveryKey(bad));
      expect(res.wasm).toBeNull();
      expect(res.ts).toBeNull();
    }
  });
});

describe('differential parity: 128-bit/256-bit money & FX engine', () => {
  it('matches rateToScaled for valid, >12-decimal, and invalid inputs', () => {
    for (const r of ['0', '1', '16250', '0.000000000001', ' 4.285 ', '1.123456789012999']) {
      const res = runInBoth(() => rateToScaled(r));
      expect(res.wasm).toBe(res.ts);
    }
    for (const bad of ['', '-1', '1.', '.5', 'abc', '1e5']) {
      for (const mode of ['wasm', 'ts-fallback'] as const) {
        setRustCoreModeForTests(mode);
        expect(() => rateToScaled(bad)).toThrow(`Kurs tidak valid: ${bad}`);
      }
    }
  });

  it('matches convertMinor across currencies, signs, rounding ties, and errors', () => {
    const cases: [number, string, string, string][] = [
      [1000, 'USD', 'IDR', '15873.45'],
      [100_000, 'IDR', 'MYR', '0.000287'],
      [100, 'TRY', 'USD', '0.025'],
      [-100, 'TRY', 'USD', '0.025'],
      [0, 'USD', 'IDR', '16250'],
      [123456, 'MYR', 'MYR', '1'],
      [500, 'JPY', 'EUR', '0.006153846153'],
      [-1, 'IDR', 'USD', '0.0000001'],
    ];
    for (const [minor, from, to, rate] of cases) {
      const res = runInBoth(() => convertMinor(minor, from, to, rate));
      expect(res.wasm).toBe(res.ts);
    }

    for (const mode of ['wasm', 'ts-fallback'] as const) {
      setRustCoreModeForTests(mode);
      expect(() => convertMinor(10.5, 'USD', 'IDR', '16000')).toThrow();
      expect(() => convertMinor(100, 'USD', 'IDR', '-2')).toThrow('Kurs tidak valid: -2');
      expect(() => convertMinor(9_000_000_000_000_000, 'USD', 'IDR', '16250')).toThrow(
        'Hasil konversi di luar batas aman',
      );
    }
  });

  it('matches crossRate and tryConvertMajor across pairs, tiny crypto values, and boundaries', () => {
    const pairs: [string, string][] = [
      ['IDR', 'USD'],
      ['USD', 'IDR'],
      ['MYR', 'TRY'],
      ['EUR', 'SGD'],
      ['MYR', 'MYR'],
    ];
    for (const [from, to] of pairs) {
      const res = runInBoth(() => crossRate(from, to));
      expect(res.wasm).toBe(res.ts);
    }

    for (const mode of ['wasm', 'ts-fallback'] as const) {
      setRustCoreModeForTests(mode);
      expect(() => crossRate('IDR', 'XYZ')).toThrow(MissingRateError);
      expect(() => crossRate('IDR', 'USD', { IDR: '0', USD: '1' })).toThrow(MissingRateError);
    }

    const majorCases: [number, string, string][] = [
      [0.00363, 'USD', 'IDR'],
      [0.0000123456, 'USD', 'IDR'],
      [12.345, 'USD', 'USD'],
      [-12.345, 'USD', 'USD'],
      [0, 'USD', 'IDR'],
      [1_000_000, 'MYR', 'IDR'],
      [Number.NaN, 'USD', 'IDR'],
      [Number.POSITIVE_INFINITY, 'USD', 'IDR'],
      [9_000_000_000_000_000, 'USD', 'IDR'],
    ];
    for (const [major, from, to] of majorCases) {
      const res = runInBoth(() => tryConvertMajor(major, from, to));
      expect(res.wasm).toBe(res.ts);
    }
  });

  it('matches parseAmountInput across locales and edge cases', () => {
    const inputs: [string, string][] = [
      ['45.000', 'IDR'],
      ['Rp 1.250.000', 'IDR'],
      ['12.50', 'MYR'],
      ['12,5', 'MYR'],
      ['1,234.56', 'MYR'],
      ['1.234,56', 'TRY'],
      ['1,000', 'USD'],
      ['0.99', 'USD'],
      ['1..5', 'USD'],
      ['00000000000000000000000000012.5', 'USD'],
      ['', 'IDR'],
      ['abc', 'USD'],
      ['.,', 'TRY'],
      ['99999999999999999999', 'IDR'],
    ];
    for (const [text, code] of inputs) {
      const res = runInBoth(() => parseAmountInput(text, code));
      expect(res.wasm).toBe(res.ts);
    }
  });
});

describe('differential parity: Unicode Jaccard dedupe & statement reconciliation', () => {
  it('matches similarity across Turkish dotless i/İ, diacritics, punctuation, and empty tokens', () => {
    const pairs: [string, string][] = [
      ['APOTEK K-24 KEMANG', 'Apotek K-24'],
      ['Sewa kos', 'Bioskop XXI'],
      ['', 'x'],
      ['İstanbul Kahvesı', 'istanbul kahvesi'],
      ['Café Résumé Crème', 'cafe resume creme'],
      ['PT. MAJU-JAYA_ABADI 123', 'maju jaya 123'],
      ['ab cd ef', 'ab cd ef'],
    ];
    for (const [a, b] of pairs) {
      const res = runInBoth(() => similarity(a, b));
      expect(res.wasm).toBeCloseTo(res.ts, 12);
    }
  });

  it('matches reconcileStatement across matched, diff, multi-currency, and overflow cases', () => {
    const account: Account = {
      id: 'acc-1',
      bank: 'bca',
      name: 'BCA Utama',
      type: 'tabungan',
      currency: 'IDR',
      openingBalance: 1_000_000,
    };
    const existing: Transaction[] = [
      {
        id: 't1',
        type: 'expense',
        merchant: 'Kopi',
        categoryKey: 'food',
        accountId: 'acc-1',
        date: '2026-11-01',
        time: '09:00',
        amount: 50_000,
        currency: 'IDR',
        source: 'manual',
      },
      {
        id: 't2',
        type: 'expense',
        merchant: 'Future',
        categoryKey: 'food',
        accountId: 'acc-1',
        date: '2026-11-20',
        time: '09:00',
        amount: 99_000,
        currency: 'IDR',
        source: 'manual',
      },
    ];
    const rows = [
      {
        date: '2026-11-05',
        description: 'Gaji',
        amount: 500_000,
        currency: 'IDR',
        type: 'income' as const,
        categoryKey: 'income',
        time: null,
      },
      {
        date: '2026-11-06',
        description: 'Netflix',
        amount: 1000,
        currency: 'USD',
        type: 'expense' as const,
        categoryKey: 'bills',
        time: null,
      },
      {
        date: '2026-11-25',
        description: 'After close',
        amount: 25_000,
        currency: 'IDR',
        type: 'expense' as const,
        categoryKey: 'other',
        time: null,
      },
    ];

    const matched = runInBoth(() =>
      reconcileStatement(
        { closingBalance: 1_287_500, closingDate: '2026-11-10', closingCurrency: 'IDR', rows },
        rows,
        account,
        existing,
      ),
    );
    expect(matched.wasm).toEqual(matched.ts);
    expect(matched.wasm?.matched).toBe(true);

    const diff = runInBoth(() =>
      reconcileStatement(
        { closingBalance: 1_200_000, closingDate: '2026-11-10', closingCurrency: 'IDR', rows },
        rows,
        account,
        existing,
      ),
    );
    expect(diff.wasm).toEqual(diff.ts);
    expect(diff.wasm?.difference).toBe(-87_500);

    const overflowAccount: Account = { ...account, openingBalance: Number.MAX_SAFE_INTEGER };
    const overflow = runInBoth(() =>
      reconcileStatement(
        { closingBalance: 0, closingDate: '2026-11-10', closingCurrency: 'IDR', rows: [rows[0]!] },
        [rows[0]!],
        overflowAccount,
        [],
      ),
    );
    expect(overflow.wasm).toBeNull();
    expect(overflow.ts).toBeNull();
  });
});

describe('differential parity: SmartLog parseAmount & UTF-16 cyrb53 fingerprint', () => {
  it('matches parseAmount on all separator styles and invalid cases', () => {
    const cases: [string, string][] = [
      ['45.000', 'IDR'],
      ['45.000,00', 'IDR'],
      ['45.000,60', 'IDR'],
      ['1.250.000', 'IDR'],
      ['210,000.00', 'IDR'],
      ['12.50', 'USD'],
      ['12,5', 'USD'],
      ['1,234.56', 'USD'],
      ['1.25.000', 'IDR'],
      ['0', 'IDR'],
      ['12.345.67', 'IDR'],
      ['99999999999999999999', 'IDR'],
    ];
    for (const [raw, cur] of cases) {
      const res = runInBoth(() => parseAmount(raw, cur));
      expect(res.wasm).toBe(res.ts);
    }
  });

  it('matches parseNotification including UTF-16 cyrb53 fingerprint with ₺, €, Turkish, and emoji', () => {
    const captures = [
      {
        pkg: 'com.bca.mybca.omni.android',
        title: 'Transaksi Berhasil ☕️',
        text: 'Pembayaran QRIS Rp 45.000,00 di KOPI SENJA berhasil 💸',
      },
      {
        pkg: 'com.btpn.dc',
        title: 'Jenius ₺ / €',
        text: 'Kamu membayar EUR 19.99 di İstanbul Café € 🔥',
      },
      {
        pkg: 'com.btpn.dc',
        title: 'Jenius TRY',
        text: 'Kamu membayar ₺350,50 di BİM MARKET berhasil',
      },
    ];
    for (const c of captures) {
      const res = runInBoth(() => parseNotification(c));
      expect(res.wasm).toEqual(res.ts);
      expect(res.wasm.ok).toBe(true);
      if (res.wasm.ok) {
        expect(res.wasm.fingerprint).toMatch(/^[0-9a-f]{16}$/);
      }
    }
  });
});
