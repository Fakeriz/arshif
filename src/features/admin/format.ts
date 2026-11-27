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

/** Format rasio 0..1 ke persen bergaya Indonesia (mis. 0.124 -> "12,4%"). */
export function pct(ratio: number | null, digits = 1): string {
  if (ratio === null || !Number.isFinite(Number(ratio))) return '-';
  return `${(Number(ratio) * 100).toFixed(digits).replace('.', ',')}%`;
}

/** Format latensi milidetik (< 1000 md -> "340 md", >= 1000 md -> "1,4 dtk"). */
export function msLabel(ms: number | null): string {
  if (ms === null || !Number.isFinite(Number(ms))) return '-';
  const v = Number(ms);
  if (v < 1000) return `${Math.round(v)} md`;
  return `${(Math.round(v / 100) / 10).toFixed(1).replace('.', ',')} dtk`;
}

/** Sisa hari hingga tanggal target ISO; 0 bila sudah lewat, null bila kosong/tidak valid. */
export function daysRemaining(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null;
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return null;
  const diff = target - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86_400_000);
}

/** Hitung estimasi tanggal akhir Pro baru sesuai aturan reserve_grant: max(now, baseIso) + days. */
export function addDaysIso(baseIso: string | null, days: number, now: number = Date.now()): string {
  const parsed = baseIso ? Date.parse(baseIso) : NaN;
  const baseMs = Number.isFinite(parsed) ? Math.max(now, parsed) : now;
  return new Date(baseMs + days * 86_400_000).toISOString();
}

/** Format angka kurs FX (presisi adaptif sesuai besaran nilai). */
export function formatRate(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const maxFrac = value >= 100 ? 2 : value >= 1 ? 4 : 6;
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: maxFrac }).format(value);
}

/** Pesan error RPC/function yang ditampilkan ke admin: kode singkat, bukan stack. */
export function errorCode(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string') return (e as { code: string }).code;
  return e instanceof Error ? e.message : 'unknown';
}
