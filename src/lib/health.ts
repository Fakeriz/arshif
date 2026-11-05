/**
 * Health Score 0–100, dihitung dengan rumus (bukan LLM) dari 5 pilar (FR-COACH-1).
 * Bobot dari PRD; kurva tiap pilar adalah asumsi Fase 1 dan bisa dikalibrasi.
 */
export type HealthInputs = {
  /** Penghasilan bulan ini, minor units. */
  income: number;
  /** Setoran tabungan bulan ini. */
  saved: number;
  /** Kategori yang punya batas, dan berapa yang masih di bawah batas. */
  budgetedCategories: number;
  withinBudget: number;
  /** Cicilan/utang yang dibayar bulan ini. */
  debtPayments: number;
  /** Saldo likuid dan rata-rata pengeluaran bulanan, untuk dana darurat. */
  liquidBalance: number;
  monthlyExpense: number;
  /** Tagihan jatuh tempo periode ini dan yang dibayar tepat waktu. */
  billsDue: number;
  billsOnTime: number;
};

export type Pillar = { key: string; label: string; points: number; max: number; hint: string };

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function healthPillars(i: HealthInputs): Pillar[] {
  const savingsRatio = i.income > 0 ? i.saved / i.income : 0;
  const adherence = i.budgetedCategories > 0 ? i.withinBudget / i.budgetedCategories : 1;
  const dti = i.income > 0 ? i.debtPayments / i.income : 1;
  const months = i.monthlyExpense > 0 ? i.liquidBalance / i.monthlyExpense : 0;
  const onTime = i.billsDue > 0 ? i.billsOnTime / i.billsDue : 1;
  return [
    { key: 'savings', label: 'Rasio tabungan', max: 25, points: round1(25 * clamp(savingsRatio / 0.2)), hint: 'Target 20% dari penghasilan' },
    { key: 'budget', label: 'Kepatuhan anggaran', max: 20, points: round1(20 * clamp(adherence)), hint: 'Kategori yang masih di bawah batas' },
    { key: 'debt', label: 'Beban utang', max: 20, points: round1(20 * clamp((0.4 - dti) / 0.3)), hint: 'Cicilan di bawah 10% penghasilan itu ideal' },
    { key: 'emergency', label: 'Dana darurat', max: 20, points: round1(20 * clamp(months / 6)), hint: 'Target 6 bulan pengeluaran' },
    { key: 'bills', label: 'Tagihan tepat waktu', max: 15, points: round1(15 * clamp(onTime)), hint: 'Tagihan dibayar sebelum jatuh tempo' },
  ];
}

export function healthScore(i: HealthInputs): number {
  return Math.round(healthPillars(i).reduce((s, p) => s + p.points, 0));
}
