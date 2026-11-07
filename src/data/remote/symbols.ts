import { FUNCTIONS, SymbolSearchResponse, type SymbolHit } from '../../../supabase/functions/_shared/contracts';

import { invokeFn } from './functions';

/** Cari saham IDX/US lewat Edge Function symbol-search (hasil sudah disaring sesuai aturan penyedia harga). */
export async function searchSymbolsRemote(market: SymbolHit['market'], q: string): Promise<SymbolHit[]> {
  return (await invokeFn(FUNCTIONS.symbolSearch, { market, q }, SymbolSearchResponse)).results;
}
