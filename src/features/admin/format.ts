import { isoDateLabel, isoDateTimeLabel } from '@/lib/dates';

export const num = (n: number): string => new Intl.NumberFormat('id-ID').format(n);
export const date = (iso: string): string => isoDateLabel(iso, 'id');
export const dateTime = (iso: string): string => isoDateTimeLabel(iso, 'id');

/** "baru saja", "12 menit lalu", "3 jam lalu", lalu tanggal + jam. */
export function ago(iso: string, now: number = Date.now()): string {
  const min = Math.floor((now - Date.parse(iso)) / 60_000);
  if (min < 2) return 'baru saja';
  if (min < 60) return `${min} menit lalu`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} jam lalu`;
  return dateTime(iso);
}

/** Pesan error RPC/function yang ditampilkan ke admin: kode singkat, bukan stack. */
export function errorCode(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string') return (e as { code: string }).code;
  return e instanceof Error ? e.message : 'unknown';
}
