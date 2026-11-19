import { useT } from '@/i18n';
import { getBank } from '@/constants/banks';
import type { CardProduct } from '@/lib/cardCatalog';
import { PAYLATER_LOGOS } from '@/lib/finlogos';

import { CardArt } from './CardArt';

/** Pola motif tetap per produk (hash id), supaya kartu satu bank tidak kembar dan tidak berubah antar render. */
export function artVariant(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 4;
}
/** Nama tingkat atas di banyak bank (ID, MY, TR). Hanya memengaruhi lapisan gelap artwork, bukan data produk. */
const PREMIUM_RE = /\b(black|infinite|world|signature|prioritas|private|prestij|precious|reserve|elite)\b/i;

/** Artwork satu produk; paylater tanpa kartu fisik memakai pola "Custom Art". */
export function ProductArt({ product, width, height, asBackground }: { product: CardProduct; width: number; height?: number; asBackground?: boolean }) {
  const t = useT();
  const b = getBank(product.bank);
  const variant = artVariant(product.id);
  return product.customArt ? (
    <CardArt
      bank={product.bank}
      width={width}
      height={height}
      asBackground={asBackground}
      variant={variant}
      customArt={{ title: b.name, caption: t('acct.cardStyle.paylaterCaption'), mark: t('acct.cardStyle.customArtMark'), logo: PAYLATER_LOGOS[product.bank] }}
    />
  ) : (
    <CardArt bank={product.bank} width={width} height={height} variant={variant} premium={PREMIUM_RE.test(product.name)} label={product.name} scheme={product.scheme} />
  );
}

/** Nama di bawah kartu: produk custom art diberi akhiran "(Custom Art)" seperti referensi. */
export function productLabel(product: CardProduct, t: ReturnType<typeof useT>): string {
  return product.customArt ? `${product.name} ${t('acct.cardStyle.customArtSuffix')}` : product.name;
}

