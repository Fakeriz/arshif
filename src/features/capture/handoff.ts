import { Platform } from 'react-native';

import type { ImportResult, ScanResult, VoiceResult } from '../../../supabase/functions/_shared/contracts';

/**
 * Hasil AI dari layar capture ke layar review. Disimpan di memori (bukan parameter URL) karena besar
 * dan berisi data keuangan. Hilang saat aplikasi ditutup: layar review lalu menampilkan state kosong.
 */
type Handoff = {
  /** txId terisi = baca ulang struk transaksi yang sudah ada (foto miliknya, jangan dihapus). */
  scan: { result: ScanResult; receiptPath: string; txId?: string } | null;
  /** Struk berikutnya dari Beberapa struk, dicek setelah `scan` disimpan. */
  scanQueue: { result: ScanResult; receiptPath: string }[] | null;
  voice: { result: VoiceResult; audioUri?: string; durationSec?: number } | null;
  import: { result: ImportResult; accountId: string } | null;
};

const box: Handoff = { scan: null, scanQueue: null, voice: null, import: null };

function revokeAudio(v: Handoff['voice']): void {
  if (Platform.OS === 'web' && typeof URL !== 'undefined' && v?.audioUri?.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(v.audioUri);
    } catch {
      /* ignore */
    }
  }
}

export function putHandoff<K extends keyof Handoff>(key: K, value: NonNullable<Handoff[K]>): void {
  if (key === 'voice' && box.voice?.audioUri && box.voice.audioUri !== (value as NonNullable<Handoff['voice']>).audioUri) {
    revokeAudio(box.voice);
  }
  box[key] = value;
}

export function peekHandoff<K extends keyof Handoff>(key: K): Handoff[K] {
  return box[key];
}

export function clearHandoff(key: keyof Handoff): void {
  if (key === 'voice') revokeAudio(box.voice);
  box[key] = null;
}

export function clearAllHandoffs(): void {
  clearHandoff('scan');
  clearHandoff('scanQueue');
  clearHandoff('voice');
  clearHandoff('import');
}
