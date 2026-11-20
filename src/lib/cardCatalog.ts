import type { CardScheme } from '@/components/ui/CardArt';
import { BANKS, getBank, type BankDef } from '@/constants/banks';
import { CARD_PRODUCTS } from '@/data/cardProducts';

export type CardKind = 'credit' | 'debit' | 'paylater';
export const CARD_KINDS: CardKind[] = ['credit', 'debit', 'paylater'];

/**
 * Satu produk kartu di katalog "Pilih Tampilan Kartu". `name` = nama produk TANPA nama bank (ditampilkan di bawah
 * kartu, bank sudah jadi judul grup). `source` = halaman resmi yang menyebut produk ini (diperiksa saat katalog dibuat).
 */
export type CardProduct = { id: string; bank: string; name: string; kind: CardKind; scheme: CardScheme | null; customArt?: boolean; source: string };

export type PickerCountry = Exclude<BankDef['country'], 'ANY'>;
export const PICKER_COUNTRIES: PickerCountry[] = ['ID', 'MY', 'TR'];

const byId = new Map(CARD_PRODUCTS.map((p) => [p.id, p]));
export const cardProduct = (id: string | null | undefined): CardProduct | null => (id ? (byId.get(id) ?? null) : null);

const countryOf = (bank: string): BankDef['country'] => getBank(bank).country;

/** Jumlah kartu per negara dan total, dihitung dari katalog (bukan angka tetap). */
export function countryCounts(products: readonly CardProduct[] = CARD_PRODUCTS): { all: number } & Record<PickerCountry, number> {
  const out = { all: products.length, ID: 0, MY: 0, TR: 0 };
  for (const p of products) {
    const c = countryOf(p.bank);
    if (c !== 'ANY') out[c]++;
  }
  return out;
}

/** Jenis yang punya kartu di negara itu (tab yang tidak punya kartu tidak ditampilkan, seperti referensi). */
export function kindsIn(country: PickerCountry | 'all', products: readonly CardProduct[] = CARD_PRODUCTS): CardKind[] {
  const present = new Set(products.filter((p) => country === 'all' || countryOf(p.bank) === country).map((p) => p.kind));
  return CARD_KINDS.filter((k) => present.has(k));
}

/** Teks pencarian dibandingkan tanpa beda huruf besar/kecil dan aksen (İş Bankası = is bankasi). */
const fold = (s: string) => s.toLocaleLowerCase('en').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

/**
 * Grup per bank (urutan pemilih bank) untuk negara + jenis + kueri. Kueri cocok dengan nama bank atau nama produk;
 * bank yang namanya cocok menampilkan semua kartunya.
 */
export function groupCatalog(
  { country, kind, query }: { country: PickerCountry | 'all'; kind: CardKind; query: string },
  products: readonly CardProduct[] = CARD_PRODUCTS,
): { bank: string; products: CardProduct[] }[] {
  const q = fold(query.trim());
  const groups: { bank: string; products: CardProduct[] }[] = [];
  for (const b of BANKS) {
    if (country !== 'all' && b.country !== country) continue;
    const bankHit = q !== '' && fold(b.name).includes(q);
    const list = products.filter((p) => p.bank === b.key && p.kind === kind && (q === '' || bankHit || fold(p.name).includes(q)));
    if (list.length) groups.push({ bank: b.key, products: list });
  }
  return groups;
}
