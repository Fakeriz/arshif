import type { Subscription, SubscriptionCycle } from '@/data/planning';

/** Layanan populer: nama + kategori. Harga tidak diisi otomatis (beda per negara dan paket). */
export const SUBSCRIPTION_PRESETS = [
  { key: 'netflix', name: 'Netflix', categoryKey: 'entertainment' },
  { key: 'spotify', name: 'Spotify', categoryKey: 'entertainment' },
  { key: 'youtube_premium', name: 'YouTube Premium', categoryKey: 'entertainment' },
  { key: 'icloud', name: 'iCloud+', categoryKey: 'phone' },
  { key: 'chatgpt', name: 'ChatGPT Plus', categoryKey: 'education' },
] as const;

export type CycleLike = { amount: number; cycle: SubscriptionCycle };

/** Biaya setara per bulan (mingguan × 52 / 12, tahunan / 12), dibulatkan. */
export function monthlyCost(s: CycleLike): number {
  switch (s.cycle) {
    case 'weekly':
      return Math.round((s.amount * 52) / 12);
    case 'monthly':
      return s.amount;
    case 'yearly':
      return Math.round(s.amount / 12);
  }
}

export function yearlyCost(s: CycleLike): number {
  return s.cycle === 'weekly' ? s.amount * 52 : s.cycle === 'monthly' ? s.amount * 12 : s.amount;
}

/**
 * Total bulanan dan tahunan langganan aktif dalam mata uang utama. Mata uang tanpa kurs dilewati dan dilaporkan
 * (missing) supaya layar bisa memberi tahu, bukan diam-diam salah.
 */
export function subscriptionTotals(
  subs: Pick<Subscription, 'amount' | 'cycle' | 'currency' | 'status'>[],
  main: string,
  convert: (minor: number, from: string, to: string) => number | null,
): { monthly: number; yearly: number; missing: string[] } {
  let monthly = 0;
  let yearly = 0;
  const missing = new Set<string>();
  for (const s of subs) {
    if (s.status !== 'active') continue;
    const m = convert(monthlyCost(s), s.currency, main);
    const y = convert(yearlyCost(s), s.currency, main);
    if (m === null || y === null) {
      missing.add(s.currency);
      continue;
    }
    monthly += m;
    yearly += y;
  }
  return { monthly, yearly, missing: [...missing] };
}
