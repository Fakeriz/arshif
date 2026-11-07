/** HTTP bersama untuk penyedia harga: batas waktu per permintaan dan antrean paralel kecil. Tanpa import (diuji di Jest). */

/** GET JSON dengan batas waktu sendiri. Status bukan 2xx = error berisi kode status. */
export async function getJson(url: string, timeoutMs: number, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: 'application/json', ...headers }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.json();
}

/** Jalankan `fn` untuk tiap item dengan paling banyak `limit` sekaligus. Error per item ditangkap pemanggil. */
export async function eachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e)).slice(0, 120);
