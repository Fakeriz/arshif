/**
 * Inti sync harga aset (brief Fase Aset §5), tanpa I/O supaya bisa diuji dan dipakai ulang oleh runner lain.
 * Kunci harga netral: IDX:BBCA, US:AAPL, CRYPTO:BTC, GOLD:XAU (cermin assets.price_key).
 */

/**
 * `source` = penyedia yang benar-benar memberi harga (dipakai rantai penyedia); tanpa itu nama penyedia dipakai.
 * `quotedAt` = waktu harga itu terjadi menurut penyedia (ISO). Bisa jauh lebih tua dari waktu sync: IDX tertunda, pasar tutup.
 */
export type Quote = { price: number; currency: string; source?: string; quotedAt?: string };
export type ProviderResult = { quotes: Record<string, Quote> };

/** Penyedia harga. Kunci yang tidak dikenal penyedia cukup tidak dikembalikan; jangan lempar error untuk satu kunci. */
export type PriceProvider = { name: string; fetch(keys: string[]): Promise<ProviderResult> };
/** Penyedia utama per sumber: hanya kunci yang `handles` yang dikirim ke sana. */
export type SourcedProvider = PriceProvider & { handles(key: string): boolean };

export type PriceRow = { symbol: string; price: number; currency: string; source: string; fetched_at: string; quoted_at: string | null };
export type SyncResult = { rows: PriceRow[]; failed: string[]; error?: string };

export const PRICE_KEY_RE = /^(IDX|US|CRYPTO|GOLD):[A-Z0-9.]{1,15}$/;

/** Stablecoin dolar disimpan sebagai USD (kolom currency = kode ISO 3 huruf). */
function isoCurrency(code: string): string | null {
  const c = code.toUpperCase();
  if (c === 'USDT' || c === 'USDC') return 'USD';
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

/** Waktu quote yang masuk akal: tanggal valid, tidak di masa depan (jam penyedia yang maju dipotong ke `now`). */
export function quoteTime(raw: string | undefined, now: Date): string | null {
  if (!raw) return null;
  const at = Date.parse(raw);
  if (!Number.isFinite(at) || at <= 0) return null;
  return new Date(Math.min(at, now.getTime())).toISOString();
}

/** Detik Unix dari penyedia -> ISO; selain angka positif = tidak diketahui. */
export const fromUnix = (sec: unknown): string | undefined => (typeof sec === 'number' && sec > 0 ? new Date(sec * 1000).toISOString() : undefined);

/**
 * Ambil harga untuk semua kunci sekaligus. Satu kunci gagal tidak menggagalkan yang lain:
 * kunci itu masuk `failed` dan barisnya di asset_prices tidak disentuh (harga terakhir tetap dipakai).
 */
export async function runPriceSync(keys: string[], provider: PriceProvider, now: Date): Promise<SyncResult> {
  const valid = [...new Set(keys)].filter((k) => PRICE_KEY_RE.test(k)).sort();
  if (valid.length === 0) return { rows: [], failed: [] };
  let quotes: Record<string, Quote>;
  try {
    ({ quotes } = await provider.fetch(valid));
  } catch (e) {
    return { rows: [], failed: valid, error: (e instanceof Error ? e.message : String(e)).slice(0, 200) };
  }
  const rows: PriceRow[] = [];
  for (const key of valid) {
    const q = quotes[key];
    const currency = q ? isoCurrency(q.currency) : null;
    if (!q || !currency || !Number.isFinite(q.price) || q.price <= 0) continue;
    rows.push({ symbol: key, price: q.price, currency, source: q.source ?? provider.name, fetched_at: now.toISOString(), quoted_at: quoteTime(q.quotedAt, now) });
  }
  const ok = new Set(rows.map((r) => r.symbol));
  return { rows, failed: valid.filter((k) => !ok.has(k)) };
}

/** Baris riwayat harian dari hasil sync: hari = tanggal UTC waktu sync. */
export const historyRows = (rows: PriceRow[]) => rows.map((r) => ({ symbol: r.symbol, day: r.fetched_at.slice(0, 10), price: r.price, currency: r.currency }));

/** Kunci per potongan: harga potongan selesai langsung disimpan, jadi batas waktu fungsi tidak menghapus semuanya. */
export const SYNC_BATCH = 200;

/**
 * Sinkron bertahap: ambil harga per potongan lalu simpan sebelum lanjut. `save` melempar bila penyimpanan gagal
 * (job berhenti, potongan sebelumnya sudah tersimpan). Hasil = gabungan semua potongan.
 */
export async function syncInBatches(
  keys: string[],
  provider: PriceProvider,
  now: Date,
  save: (rows: PriceRow[]) => Promise<void>,
  size = SYNC_BATCH,
): Promise<{ updated: number; failed: string[]; error?: string }> {
  const out: { updated: number; failed: string[]; error?: string } = { updated: 0, failed: [] };
  for (let i = 0; i < keys.length; i += size) {
    const r = await runPriceSync(keys.slice(i, i + size), provider, now);
    if (r.rows.length > 0) await save(r.rows);
    out.updated += r.rows.length;
    out.failed.push(...r.failed);
    out.error ??= r.error;
  }
  return out;
}

/** Hasil satu penyedia dalam satu run, dicatat per baris di asset_price_runs. `failed` = kunci yang tidak ia dapatkan. */
export type ProviderRun = { source: string; symbols: number; updated: number; failed: string[]; error?: string; durationMs: number };

function validQuote(q: Quote | undefined): q is Quote {
  return !!q && Number.isFinite(q.price) && q.price > 0 && isoCurrency(q.currency) !== null;
}

/**
 * Rantai penyedia: tiap sumber utama mengambil kunci miliknya sendiri, terisolasi (error/timeout satu sumber tidak
 * menghentikan yang lain). Kunci yang belum dapat harga, termasuk yang tidak ditangani sumber mana pun, baru dikirim
 * ke `fallback`. Hasil per penyedia ditambahkan ke `runs` (dijumlahkan lintas potongan).
 */
export function chainProvider(primaries: SourcedProvider[], fallback: PriceProvider | null, runs: ProviderRun[], clock: () => number = Date.now): PriceProvider {
  const record = (source: string, keys: string[], got: string[], ms: number, error?: string) => {
    const run = runs.find((r) => r.source === source) ?? runs[runs.push({ source, symbols: 0, updated: 0, failed: [], durationMs: 0 }) - 1];
    const ok = new Set(got);
    run.symbols += keys.length;
    run.updated += got.length;
    run.failed.push(...keys.filter((k) => !ok.has(k)));
    run.durationMs += ms;
    run.error ??= error;
  };
  const attempt = async (p: PriceProvider, keys: string[]): Promise<Record<string, Quote>> => {
    const started = clock();
    const out: Record<string, Quote> = {};
    let error: string | undefined;
    try {
      const { quotes } = await p.fetch(keys);
      for (const k of keys) if (validQuote(quotes[k])) out[k] = { ...quotes[k], source: p.name };
    } catch (e) {
      error = (e instanceof Error ? e.message : String(e)).slice(0, 200);
    }
    record(p.name, keys, Object.keys(out), Math.max(0, clock() - started), error);
    return out;
  };
  return {
    name: 'chain',
    async fetch(keys) {
      const parts = primaries.map((p) => [p, keys.filter((k) => p.handles(k))] as const).filter(([, ks]) => ks.length > 0);
      const results = await Promise.all(parts.map(([p, ks]) => attempt(p, ks)));
      const quotes: Record<string, Quote> = Object.assign({}, ...results);
      const rest = keys.filter((k) => !quotes[k]);
      if (fallback && rest.length > 0) Object.assign(quotes, await attempt(fallback, rest));
      return { quotes };
    },
  };
}
