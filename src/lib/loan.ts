/**
 * Kalkulator cicilan / KPR (FR-TAX-1). Nominal integer unit terkecil, bunga tahunan dalam basis poin.
 * - annuity: cicilan tetap tiap bulan (KPR, kredit bank). Bunga tiap bulan dari sisa pokok.
 * - flat: bunga dihitung dari pokok awal untuk seluruh tenor (umum di kredit kendaraan dan KTA).
 * Sisa pembulatan masuk ke cicilan terakhir, jadi jumlah pokok yang dibayar selalu = pinjaman.
 */

export type LoanMethod = 'annuity' | 'flat';

export type LoanResult = {
  /** Cicilan bulan pertama (anuitas: sama tiap bulan kecuali bulan terakhir). */
  monthly: number;
  /** Cicilan bulan terakhir (bisa beda sedikit karena pembulatan). */
  last: number;
  totalInterest: number;
  totalPaid: number;
  months: number;
};

export function loanSchedule(principal: number, aprBp: number, months: number, method: LoanMethod): LoanResult {
  const p = Math.max(0, Math.trunc(principal));
  const n = Math.max(1, Math.trunc(months));
  if (p === 0) return { monthly: 0, last: 0, totalInterest: 0, totalPaid: 0, months: n };

  if (method === 'flat' || aprBp <= 0) {
    // Bunga flat setahun = pokok × tarif; untuk n bulan = pokok × tarif × n / 12.
    const interest = aprBp <= 0 ? 0 : Math.round((p * aprBp * n) / (10000 * 12));
    const total = p + interest;
    const monthly = Math.floor(total / n);
    const last = total - monthly * (n - 1);
    return { monthly, last, totalInterest: interest, totalPaid: total, months: n };
  }

  const r = aprBp / 10000 / 12;
  const payment = Math.round((p * r) / (1 - Math.pow(1 + r, -n)));
  let balance = p;
  let interestSum = 0;
  let last = payment;
  for (let k = 1; k <= n; k++) {
    const interest = Math.round(balance * r);
    interestSum += interest;
    const principalPart = k === n ? balance : Math.min(balance, payment - interest);
    if (k === n) last = principalPart + interest;
    balance -= principalPart;
  }
  return { monthly: payment, last, totalInterest: interestSum, totalPaid: p + interestSum, months: n };
}
