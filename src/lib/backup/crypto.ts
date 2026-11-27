import { gcm } from '@noble/ciphers/aes';
import { getRandomBytes } from 'expo-crypto';

import {
  rustFormatRecoveryKey,
  rustOpenBackup,
  rustParseRecoveryKey,
  rustReadBackupHeaderBounds,
  rustSealBackup,
} from '../rust';

/**
 * File cadangan Arshif (.arshif): "ARSHIFBK" | versi (1 byte) | panjang header (uint32 BE) | header JSON | nonce (12) | AES-256-GCM.
 * Header berisi tanggal dan opsi saja (tanpa data keuangan) dan ikut diautentikasi sebagai AAD: diubah = file ditolak.
 */
const MAGIC = new TextEncoder().encode('ARSHIFBK');
const VERSION = 1;
const NONCE = 12;

export type BackupHeader = { createdAt: string; receipts: boolean };

export class BackupError extends Error {
  constructor(readonly code: 'not_backup' | 'version' | 'bad_key' | 'corrupt') {
    super(code);
  }
}

export function newBackupKey(): Uint8Array {
  return getRandomBytes(32);
}

export function encryptBackup(key: Uint8Array, header: BackupHeader, plaintext: Uint8Array): Uint8Array {
  const head = new TextEncoder().encode(JSON.stringify(header));
  const nonce = getRandomBytes(NONCE);
  const rustOut = rustSealBackup(key, head, nonce, plaintext);
  if (rustOut !== null) {
    if (rustOut.ok) return rustOut.data;
    throw new BackupError(rustOut.code);
  }
  const prefix = new Uint8Array(MAGIC.length + 1 + 4 + head.length);
  prefix.set(MAGIC, 0);
  prefix[MAGIC.length] = VERSION;
  new DataView(prefix.buffer).setUint32(MAGIC.length + 1, head.length);
  prefix.set(head, MAGIC.length + 5);
  const sealed = gcm(key, nonce, prefix).encrypt(plaintext);
  const out = new Uint8Array(prefix.length + NONCE + sealed.length);
  out.set(prefix, 0);
  out.set(nonce, prefix.length);
  out.set(sealed, prefix.length + NONCE);
  return out;
}

/** Header tanpa kunci (untuk menampilkan tanggal cadangan sebelum pengguna memasukkan kunci). */
export function readBackupHeader(file: Uint8Array): BackupHeader {
  const rustBounds = rustReadBackupHeaderBounds(file);
  if (rustBounds !== null) {
    if (!rustBounds.ok) throw new BackupError(rustBounds.code);
    try {
      return JSON.parse(
        new TextDecoder().decode(file.subarray(rustBounds.offset, rustBounds.offset + rustBounds.length)),
      ) as BackupHeader;
    } catch {
      throw new BackupError('corrupt');
    }
  }
  if (file.length < MAGIC.length + 5 || MAGIC.some((b, i) => file[i] !== b)) throw new BackupError('not_backup');
  if (file[MAGIC.length] !== VERSION) throw new BackupError('version');
  const len = new DataView(file.buffer, file.byteOffset).getUint32(MAGIC.length + 1);
  if (MAGIC.length + 5 + len + NONCE + 16 > file.length) throw new BackupError('corrupt');
  try {
    return JSON.parse(new TextDecoder().decode(file.subarray(MAGIC.length + 5, MAGIC.length + 5 + len))) as BackupHeader;
  } catch {
    throw new BackupError('corrupt');
  }
}

export function decryptBackup(key: Uint8Array, file: Uint8Array): { header: BackupHeader; plaintext: Uint8Array } {
  const header = readBackupHeader(file);
  const rustOut = rustOpenBackup(key, file);
  if (rustOut !== null) {
    if (rustOut.ok) return { header, plaintext: rustOut.plaintext };
    throw new BackupError(rustOut.code);
  }
  const len = new DataView(file.buffer, file.byteOffset).getUint32(MAGIC.length + 1);
  const end = MAGIC.length + 5 + len;
  try {
    const plaintext = gcm(key, file.subarray(end, end + NONCE), file.subarray(0, end)).decrypt(file.subarray(end + NONCE));
    return { header, plaintext };
  } catch {
    // GCM tidak membedakan kunci salah dan isi yang diubah: keduanya gagal autentikasi.
    throw new BackupError('bad_key');
  }
}

/** Base32 Crockford: tanpa I, L, O, U supaya tidak tertukar saat diketik ulang. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Kunci 32 byte -> 52 karakter dalam 13 grup 4 huruf ("A1B2-C3D4-..."). */
export function formatRecoveryKey(key: Uint8Array): string {
  const rustOut = rustFormatRecoveryKey(key);
  if (rustOut !== null) return rustOut;
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of key) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out.match(/.{1,4}/g)!.join('-');
}

/** Kebalikan formatRecoveryKey; huruf kecil, spasi, tanda hubung, O/I/L yang tertukar diterima. null = bukan kunci yang sah. */
export function parseRecoveryKey(input: string): Uint8Array | null {
  const rustRes = rustParseRecoveryKey(input);
  if (rustRes.handled) return rustRes.value;
  const clean = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (clean.length !== 52) return null;
  const out = new Uint8Array(32);
  let bits = 0;
  let value = 0;
  let i = 0;
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      if (i < 32) out[i++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return i === 32 ? out : null;
}
