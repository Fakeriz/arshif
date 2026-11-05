import type { Debt } from '@/data/planning';
import { parseYMD, ymd } from '@/lib/dates';

/** Utang untuk simulasi: saldo, bunga tahunan (basis poin), cicilan minimum. Nominal unit terkecil. */
export type SimDebt = Pick<Debt, 'id' | 'balance' | 'aprBp' | 'minPayment'>;
export type Method = 'snowball' | 'avalanche';

export type SimResult = {
  method: Method;
  /** false = cicilan tidak pernah melunasi (bunga >= pembayaran), atau melebihi 50 tahun. */
  feasible: boolean;
  months: number;
  totalInterest: number;
  /** Urutan lunas: id + bulan ke-berapa (1 = bulan pertama). */
  order: { id: string; month: number }[];
};

const MAX_MONTHS = 600;

/** Bunga sebulan = saldo × APR/12, dibulatkan ke unit terkecil. BigInt: saldo besar × basis poin melewati 2^53. */
export function monthlyInterest(balance: number, aprBp: number): number {
  const num = BigInt(balance) * BigInt(aprBp);
  const den = BigInt(120000);
  return Number((num * BigInt(2) + den) / (den * BigInt(2)));
}

/**
 * Simulasi bulanan. Tiap bulan: bunga ditambahkan, cicilan minimum dibayar ke semua utang, sisa anggaran
 * (anggaran = jumlah semua cicilan minimum + ekstra, tetap tiap bulan) ke target metode.
 * Snowball: saldo terkecil dulu. Avalanche: bunga tertinggi dulu. Cicilan utang yang sudah lunas ikut ke target.
 */
export function simulate(debts: SimDebt[], extra: number, method: Method): SimResult {
  const live = debts.filter((d) => d.balance > 0).map((d) => ({ ...d }));
  const budget = live.reduce((s, d) => s + d.minPayment, 0) + Math.max(0, extra);
  const order: SimResult['order'] = [];
  let totalInterest = 0;
  let month = 0;
  const rank = (a: SimDebt, b: SimDebt) =>
    method === 'snowball' ? a.balance - b.balance || b.aprBp - a.aprBp : b.aprBp - a.aprBp || a.balance - b.balance;

  while (live.some((d) => d.balance > 0) && month < MAX_MONTHS) {
    month++;
    let pool = budget;
    for (const d of live) {
      if (d.balance <= 0) continue;
      const interest = monthlyInterest(d.balance, d.aprBp);
      d.balance += interest;
      totalInterest += interest;
    }
    for (const d of live) {
      if (d.balance <= 0) continue;
      const pay = Math.min(d.minPayment, d.balance, pool);
      d.balance -= pay;
      pool -= pay;
    }
    for (const d of [...live].filter((x) => x.balance > 0).sort(rank)) {
      if (pool <= 0) break;
      const pay = Math.min(d.balance, pool);
      d.balance -= pay;
      pool -= pay;
    }
    for (const d of live) if (d.balance === 0 && !order.some((o) => o.id === d.id)) order.push({ id: d.id, month });
  }
  const feasible = live.every((d) => d.balance === 0);
  return { method, feasible, months: feasible ? month : 0, totalInterest, order };
}

/** Bulan ke-n dari tanggal awal (tanggal lunas perkiraan). */
export function monthAfter(start: string, n: number): string {
  const { y, m } = parseYMD(start);
  const idx = y * 12 + (m - 1) + n;
  return ymd(Math.floor(idx / 12), (idx % 12) + 1, 1);
}

export type Comparison = {
  baseline: SimResult;
  snowball: SimResult & { interestSaved: number; monthsSaved: number };
  avalanche: SimResult & { interestSaved: number; monthsSaved: number };
};

/** Snowball vs Avalanche dengan ekstra, dibandingkan dengan membayar cicilan minimum saja. */
export function compareMethods(debts: SimDebt[], extra: number): Comparison {
  const baseline = simulate(debts, 0, 'avalanche');
  const withSaving = (r: SimResult) => ({
    ...r,
    interestSaved: baseline.feasible && r.feasible ? Math.max(0, baseline.totalInterest - r.totalInterest) : 0,
    monthsSaved: baseline.feasible && r.feasible ? Math.max(0, baseline.months - r.months) : 0,
  });
  return { baseline, snowball: withSaving(simulate(debts, extra, 'snowball')), avalanche: withSaving(simulate(debts, extra, 'avalanche')) };
}
