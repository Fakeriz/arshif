import { CHECKOUT_CURRENCIES, type PERIODS } from '../../supabase/functions/_shared/contracts';

export type Period = (typeof PERIODS)[number];
export type CheckoutCurrency = (typeof CHECKOUT_CURRENCIES)[number];

/**
 * Harga Premium web (dikunci 2026-11-06), unit terkecil. Cermin tabel prices di migrasi (dicek tes);
 * server tetap memakai tabelnya sendiri, nilai ini hanya untuk tampilan.
 * Di aplikasi iOS/Android harga yang tampil adalah harga toko dari RevenueCat.
 */
export const PRICES: Record<CheckoutCurrency, Record<Period, number>> = {
  IDR: { monthly: 25000, yearly: 250000 },
  MYR: { monthly: 690, yearly: 6900 },
  USD: { monthly: 150, yearly: 1500 },
};

export const PROVIDER: Record<CheckoutCurrency, 'xendit' | 'paddle'> = { IDR: 'xendit', MYR: 'xendit', USD: 'paddle' };

/** Mata uang checkout yang paling dekat dengan mata uang utama pengguna. TRY dan lainnya lewat Paddle (USD). */
export function checkoutCurrencyFor(mainCurrency: string): CheckoutCurrency {
  return mainCurrency === 'IDR' || mainCurrency === 'MYR' ? mainCurrency : 'USD';
}

/** Bulan yang dihemat paket tahunan dibanding 12 kali bulanan. */
export function monthsFree(currency: CheckoutCurrency): number {
  const p = PRICES[currency];
  return Math.round((p.monthly * 12 - p.yearly) / p.monthly);
}
