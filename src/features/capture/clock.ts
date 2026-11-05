const pad = (n: number) => String(n).padStart(2, '0');

/** Tanggal lokal perangkat "YYYY-MM-DD" (bukan UTC), untuk default tanggal transaksi. */
export function localYmd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Jam lokal "HH:mm". */
export function localHm(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Zona waktu IANA perangkat, untuk mengubah "kemarin" jadi tanggal absolut (FR-VOICE-2). */
export function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
