import { getBank } from '@/constants/banks';
import { getCategory } from '@/constants/categories';
import { currencyMeta } from '@/lib/money';

import type { MsgKey, TFunction } from './translate';

/** Label domain yang kuncinya datang dari data (string bebas), dibungkus agar cast hanya di satu tempat. */
export function categoryLabel(t: TFunction, key: string): string {
  return t(`domain.category.${getCategory(key).key}` as MsgKey);
}

export function currencyName(t: TFunction, code: string): string {
  const m = currencyMeta(code);
  const k = `domain.currencyName.${m.code}` as MsgKey;
  const name = t(k);
  return name === k ? m.name : name;
}

/** Nama bank adalah nama merek (tidak diterjemahkan), kecuali "Tunai". */
export function bankName(t: TFunction, key: string): string {
  const b = getBank(key);
  return b.key === 'cash' ? t('domain.cashBank') : b.name;
}
