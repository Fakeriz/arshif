import type { Asset } from '@/data/assets';
import type { useT } from '@/i18n';
import type { Lang } from '@/i18n/types';
import { formatQuantity, unitOf, type Valuation } from '@/lib/assets';
import { isoDateTimeLabel } from '@/lib/dates';

type T = ReturnType<typeof useT>;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** "baru saja" / "12 mnt lalu" / "3 jam lalu"; lebih dari sehari = tanggal dan jam lengkap. */
export function agoLabel(iso: string, now: number, t: T, lang: Lang): string {
  const ms = Math.max(0, now - Date.parse(iso));
  if (ms < MINUTE) return t('assets.ago.now');
  if (ms < HOUR) return t('assets.ago.minutes', { n: Math.floor(ms / MINUTE) });
  if (ms < 24 * HOUR) return t('assets.ago.hours', { n: Math.floor(ms / HOUR) });
  return isoDateTimeLabel(iso, lang);
}

/**
 * Keterangan sumber nilai. Harga live memakai waktu quote dari penyedia ("Harga per"); bila penyedia tidak memberi
 * waktu, hanya waktu sync yang jujur ditampilkan ("Diambil"). Saham ID selalu diberi label delay bursa.
 */
export function priceLabel(a: Asset, v: Valuation, t: T, lang: Lang, now: number): string {
  if (v.source === 'manual') return t('assets.priceManual');
  if (v.source === 'buy') return t('assets.priceBuy');
  if (v.source === 'none') return t('assets.priceNone');
  const time = agoLabel(v.quotedAt ?? v.fetchedAt!, now, t, lang);
  const base = v.stale ? t('assets.priceStale', { time }) : v.quotedAt ? t('assets.priceAt', { time }) : t('assets.priceTaken', { time });
  return a.type === 'stock_id' ? `${base} · ${t('assets.idxDelay')}` : base;
}

/** "100 lembar" / "0,5 koin". Kosong untuk aset manual tanpa jumlah. */
export function quantityLabel(a: Asset, t: T, lang: Lang): string {
  return a.quantity === undefined ? '' : `${formatQuantity(a.quantity, lang)} ${t(`assets.unit.${unitOf(a.type)}`)}`;
}
