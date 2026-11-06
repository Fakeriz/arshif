/**
 * Inti sync harga aset (brief Fase Aset §5), tanpa I/O supaya bisa diuji dan dipakai ulang oleh runner lain.
 * Kunci harga netral: IDX:BBCA, US:AAPL, CRYPTO:BTC, GOLD:XAU (cermin assets.price_key).
 */

export type Quote = { price: number; currency: string };
export type ProviderResult = { quotes: Record<string, Quote> };

/** Penyedia harga. Kunci yang tidak dikenal penyedia cukup tidak dikembalikan; jangan lempar error untuk satu kunci. */
export type PriceProvider = { name: string; fetch(keys: string[]): Promise<ProviderResult> };

export type PriceRow = { symbol: string; price: number; currency: string; source: string; fetched_at: string };
export type SyncResult = { rows: PriceRow[]; failed: string[]; error?: string };

export const PRICE_KEY_RE = /^(IDX|US|CRYPTO|GOLD):[A-Z0-9.]{1,15}$/;

/** Stablecoin dolar disimpan sebagai USD (kolom currency = kode ISO 3 huruf). */
function isoCurrency(code: string): string | null {
  const c = code.toUpperCase();
  if (c === 'USDT' || c === 'USDC') return 'USD';
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

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
    rows.push({ symbol: key, price: q.price, currency, source: provider.name, fetched_at: now.toISOString() });
  }
  const ok = new Set(rows.map((r) => r.symbol));
  return { rows, failed: valid.filter((k) => !ok.has(k)) };
}
