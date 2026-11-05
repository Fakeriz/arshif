import type { ImportResult, ScanResult, VoiceResult } from '../../../supabase/functions/_shared/contracts';

/**
 * Hasil AI dari layar capture ke layar review. Disimpan di memori (bukan parameter URL) karena besar
 * dan berisi data keuangan. Hilang saat aplikasi ditutup: layar review lalu menampilkan state kosong.
 */
type Handoff = {
  scan: { result: ScanResult; receiptPath: string } | null;
  voice: { result: VoiceResult } | null;
  import: { result: ImportResult; accountId: string } | null;
};

const box: Handoff = { scan: null, voice: null, import: null };

export function putHandoff<K extends keyof Handoff>(key: K, value: NonNullable<Handoff[K]>): void {
  box[key] = value;
}

export function peekHandoff<K extends keyof Handoff>(key: K): Handoff[K] {
  return box[key];
}

export function clearHandoff(key: keyof Handoff): void {
  box[key] = null;
}
