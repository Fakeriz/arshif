/**
 * Emas spot XAUUSD dari gold-api.com (gratis, tanpa kunci). Disimpan USD per troy ounce; aplikasi mengalikan
 * dengan kurs ke mata uang pengguna dan mengubah ke gram. Ini harga pasar global, bukan harga Antam.
 */
import type { SourcedProvider } from './asset-sync.ts';
import { getJson } from './price-http.ts';

const API = 'https://api.gold-api.com/price/XAU';
const TIMEOUT_MS = 8_000;

export const goldProvider: SourcedProvider = {
  name: 'gold-api',
  handles: (key) => key === 'GOLD:XAU',
  async fetch() {
    const body = (await getJson(API, TIMEOUT_MS)) as { price?: unknown; currency?: unknown; updatedAt?: unknown };
    if (typeof body?.price !== 'number' || body.currency !== 'USD') throw new Error('bad_payload');
    const quotedAt = typeof body.updatedAt === 'string' ? body.updatedAt : undefined;
    return { quotes: { 'GOLD:XAU': { price: body.price, currency: 'USD', quotedAt } } };
  },
};
