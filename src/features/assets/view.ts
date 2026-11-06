import type { Asset } from '@/data/assets';
import type { useT } from '@/i18n';
import type { Lang } from '@/i18n/types';
import { formatQuantity, unitOf, type Valuation } from '@/lib/assets';
import { isoDateTimeLabel } from '@/lib/dates';

type T = ReturnType<typeof useT>;

/** Keterangan sumber nilai: harga live + waktunya, harga terakhir (basi), manual, harga beli, atau belum ada. */
export function priceLabel(v: Valuation, t: T, lang: Lang): string {
  if (v.source === 'manual') return t('assets.priceManual');
  if (v.source === 'buy') return t('assets.priceBuy');
  if (v.source === 'none') return t('assets.priceNone');
  const time = isoDateTimeLabel(v.fetchedAt!, lang);
  return v.stale ? t('assets.priceStale', { time }) : t('assets.priceAt', { time });
}

/** "100 lembar" / "0,5 koin". Kosong untuk aset manual tanpa jumlah. */
export function quantityLabel(a: Asset, t: T, lang: Lang): string {
  return a.quantity === undefined ? '' : `${formatQuantity(a.quantity, lang)} ${t(`assets.unit.${unitOf(a.type)}`)}`;
}
