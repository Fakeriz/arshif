import { getLocales } from 'expo-localization';

import type { AccountType } from '@/data/types';
import { DEFAULT_SPLIT, PAYDAY_MAX, PAYDAY_MIN, splitIsValid, type Split } from '@/lib/budget';
import { isCreditType } from '@/lib/credit';

export type SetupDraft = {
  mainCurrency: string;
  account: {
    name: string; type: AccountType; bank: string; currency: string;
    /** Kartu kredit/paylater: tagihan berjalan (positif di form, disimpan sebagai saldo negatif). */
    opening: number | null;
    /** Kartu kredit/paylater: limit (FR-ACC-3/8). */
    creditLimit: number | null;
  };
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
    account: { name: '', type: 'tabungan', bank: REGION_BANK[currency] ?? 'cash', currency, opening: null, creditLimit: null },
    income: null,
    payday: '25',
    split: DEFAULT_SPLIT,
    splitMode: 'preset',
  };
}

export function parsePayday(s: string): number | null {
  const n = Number(s);
  return /^\d{1,2}$/.test(s.trim()) && n >= PAYDAY_MIN && n <= PAYDAY_MAX ? n : null;
}

/** Draft akun -> kolom akun. Kartu kredit/paylater: tagihan berjalan = saldo negatif, plus limit. */
export function accountFromDraft(a: SetupDraft['account']) {
  const credit = isCreditType(a.type);
  return {
    bank: a.bank,
    name: a.name.trim(),
    type: a.type,
    currency: a.currency,
    openingBalance: credit ? -(a.opening ?? 0) : (a.opening ?? 0),
    creditLimit: credit && a.creditLimit ? a.creditLimit : undefined,
  };
}

export const splitTotal = (s: Split) => s.needs + s.wants + s.savings;

/** Kunci error per langkah; kosong = boleh lanjut. */
export function stepErrors(step: number, d: SetupDraft) {
  if (step === 1) return { name: d.account.name.trim() === '' };
  if (step === 2) return { income: !d.income || d.income <= 0, payday: parsePayday(d.payday) === null, split: !splitIsValid(d.split) };
  return {};
}
