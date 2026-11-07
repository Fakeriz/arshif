/**
 * Cari kode saham lewat endpoint search publik Yahoo Finance (gratis, tanpa kunci; tidak resmi, bisa diblokir).
 * Hasil disaring dengan aturan yang sama dengan penyedia harga (price-yahoo.ts): yang bisa dipilih pasti bisa diberi
 * harga. IDX = bursa JKT (akhiran .JK), US = bursa utama AS saja (tanpa OTC), saham atau ETF.
 */
import type { SymbolHit } from './contracts.ts';
import { US_EXCHANGES } from './price-yahoo.ts';
import { getJson } from './price-http.ts';

const API = 'https://query2.finance.yahoo.com/v1/finance/search';
const TIMEOUT_MS = 6_000;
const MAX_RESULTS = 10;
const CODE_RE = /^[A-Z0-9.]{1,15}$/;

type YahooQuote = { symbol?: unknown; shortname?: unknown; longname?: unknown; exchange?: unknown; quoteType?: unknown };

/** Simbol Yahoo -> kode netral untuk pasar itu, atau null bila bukan milik pasar tersebut. */
export function neutralCode(market: SymbolHit['market'], q: YahooQuote): string | null {
  if (typeof q.symbol !== 'string') return null;
  if (market === 'IDX') {
    if (q.exchange !== 'JKT' || q.quoteType !== 'EQUITY' || !q.symbol.endsWith('.JK')) return null;
    const code = q.symbol.slice(0, -3);
    return CODE_RE.test(code) ? code : null;
  }
  if (!US_EXCHANGES.has(q.exchange as string) || (q.quoteType !== 'EQUITY' && q.quoteType !== 'ETF')) return null;
  // Yahoo memakai tanda hubung untuk kelas saham (BRK-B); kode netral memakai titik (sama dengan yahooSymbol).
  const code = q.symbol.replace(/-/g, '.');
  return CODE_RE.test(code) ? code : null;
}

export async function searchSymbols(market: SymbolHit['market'], query: string): Promise<SymbolHit[]> {
  const url = `${API}?q=${encodeURIComponent(query)}&quotesCount=20&newsCount=0&listsCount=0&enableFuzzyQuery=false`;
  const body = (await getJson(url, TIMEOUT_MS, { 'user-agent': 'Mozilla/5.0' })) as { quotes?: YahooQuote[] };
  const seen = new Set<string>();
  const hits: SymbolHit[] = [];
  for (const q of body?.quotes ?? []) {
    const code = neutralCode(market, q);
    if (!code || seen.has(code)) continue;
    const raw = typeof q.longname === 'string' && q.longname.trim() ? q.longname : typeof q.shortname === 'string' ? q.shortname : code;
    seen.add(code);
    hits.push({ code, name: raw.trim().replace(/\s+/g, ' ').slice(0, 80) || code, market });
    if (hits.length === MAX_RESULTS) break;
  }
  return hits;
}
