import { getLocales } from 'expo-localization';

import type { AccountType } from '@/data/types';
import { DEFAULT_SPLIT, splitIsValid, type Split } from '@/lib/budget';

export type SetupDraft = {
  mainCurrency: string;
  account: { name: string; type: AccountType; bank: string; currency: string; opening: number | null };
  income: number | null;
  payday: string;
  split: Split;
  splitMode: 'preset' | 'custom';
};

const REGION_CURRENCY: Record<string, string> = { ID: 'IDR', MY: 'MYR', TR: 'TRY' };

/** Mata uang awal dari wilayah perangkat (FR-AUTH-2): ID→IDR, MY→MYR, TR→TRY, lainnya USD. */
export function regionCurrency(): string {
  try {
    const region = getLocales()[0]?.regionCode ?? '';
    return REGION_CURRENCY[region] ?? 'USD';
  } catch {
    return 'USD';
  }
}

const REGION_BANK: Record<string, string> = { IDR: 'bca', MYR: 'maybank', TRY: 'ziraat' };

export function initialDraft(): SetupDraft {
  const currency = regionCurrency();
  return {
    mainCurrency: currency,
    account: { name: '', type: 'tabungan', bank: REGION_BANK[currency] ?? 'cash', currency, opening: null },
    income: null,
    payday: '25',
    split: DEFAULT_SPLIT,
    splitMode: 'preset',
  };
}

export function parsePayday(s: string): number | null {
  const n = Number(s);
  return /^\d{1,2}$/.test(s.trim()) && n >= 1 && n <= 31 ? n : null;
}

export const splitTotal = (s: Split) => s.needs + s.wants + s.savings;

/** Kunci error per langkah; kosong = boleh lanjut. */
export function stepErrors(step: number, d: SetupDraft) {
  if (step === 1) return { name: d.account.name.trim() === '' };
  if (step === 2) return { income: !d.income || d.income <= 0, payday: parsePayday(d.payday) === null, split: !splitIsValid(d.split) };
  return {};
}
