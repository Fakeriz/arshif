import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { BackupError, decryptBackup, encryptBackup, formatRecoveryKey, parseRecoveryKey, readBackupHeader, type BackupHeader } from '@/lib/backup/crypto';
import { collectBackup, parsePayload, restoreBackup, type BackupPayload, type RestoreReport } from '@/lib/backup/data';

export const BACKUP_MIME = 'application/octet-stream';
const KEY_ITEM = 'arshif.backup.key';
const LAST_ITEM = 'arshif.backup.lastAt';
const EVERY_ITEM = 'arshif.backup.everyDays';

/** Web tidak punya penyimpanan rahasia yang aman: kunci tidak disimpan, pengguna mengetiknya tiap kali. */
export const canStoreKey = Platform.OS !== 'web';

export async function loadStoredKey(): Promise<Uint8Array | null> {
  if (!canStoreKey) return null;
  const text = await SecureStore.getItemAsync(KEY_ITEM).catch(() => null);
  return text ? parseRecoveryKey(text) : null;
}

export async function storeKey(key: Uint8Array): Promise<void> {
  if (canStoreKey) await SecureStore.setItemAsync(KEY_ITEM, formatRecoveryKey(key));
}

export function backupFileName(date = new Date()): string {
  return `arshif-cadangan-${date.toISOString().slice(0, 10)}.arshif`;
}

/** Kumpulkan semua data akun lalu enkripsi jadi satu file. */
export async function createBackupFile(userId: string, key: Uint8Array, withReceipts: boolean, onProgress?: (done: number, total: number) => void): Promise<Uint8Array> {
  const payload = await collectBackup(userId, withReceipts, onProgress);
  // shortcut: seluruh isi (termasuk struk base64) dibangun di memori; bila cadangan sering melewati ~150 MB, ganti ke format bertahap per bagian.
  const header: BackupHeader = { createdAt: new Date().toISOString(), receipts: withReceipts };
  return encryptBackup(key, header, new TextEncoder().encode(JSON.stringify(payload)));
}

/** Simpan/bagikan: web = unduh berkas; Android/iOS = lembar bagikan sistem (Files, email, dll). */
export async function saveBackupFile(bytes: Uint8Array, name = backupFileName()): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: BACKUP_MIME }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType: BACKUP_MIME, dialogTitle: name, UTI: 'public.data' });
}

/** Header dibaca tanpa kunci (tanggal dibuat, struk ikut atau tidak); melempar BackupError bila bukan file cadangan. */
export const inspectBackup = readBackupHeader;

/** Buka file dengan kunci: dekripsi + periksa isi. Melempar BackupError (kunci salah/file rusak). Hasilnya dipakai restorePayload. */
export function openBackup(key: Uint8Array, file: Uint8Array): BackupPayload {
  const { plaintext } = decryptBackup(key, file);
  const payload = parsePayload(new TextDecoder().decode(plaintext));
  if (!payload) throw new BackupError('corrupt');
  return payload;
}

export const restorePayload = restoreBackup;
export type { BackupPayload, RestoreReport };

// ---------------------------------------------------------------- pengingat terjadwal (per perangkat)

/** 0 = pengingat mati. */
export type ReminderDays = 0 | 7 | 30;
export type BackupSchedule = { lastAt: string | null; everyDays: ReminderDays };

export async function loadSchedule(): Promise<BackupSchedule> {
  try {
    const [last, every] = await Promise.all([AsyncStorage.getItem(LAST_ITEM), AsyncStorage.getItem(EVERY_ITEM)]);
    const n = Number(every);
    return { lastAt: last, everyDays: n === 7 || n === 30 ? n : n === 0 && every !== null ? 0 : 30 };
  } catch {
    return { lastAt: null, everyDays: 30 };
  }
}

export async function saveSchedule(s: Partial<BackupSchedule>): Promise<void> {
  await Promise.all([
    s.lastAt !== undefined && s.lastAt !== null ? AsyncStorage.setItem(LAST_ITEM, s.lastAt) : null,
    s.everyDays !== undefined ? AsyncStorage.setItem(EVERY_ITEM, String(s.everyDays)) : null,
  ]).catch(() => undefined);
}

/** Waktunya cadangan: pengingat aktif dan belum pernah, atau sudah lewat `everyDays` hari sejak terakhir. */
export function backupDue(s: BackupSchedule, now = Date.now()): boolean {
  if (!s.everyDays) return false;
  if (!s.lastAt) return true;
  return now - Date.parse(s.lastAt) >= s.everyDays * 86_400_000;
}
