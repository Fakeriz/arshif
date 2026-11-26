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
  const p = Number.isFinite(principal) ? Math.max(0, Math.min(Math.trunc(principal), Number.MAX_SAFE_INTEGER)) : 0;
  const n = Math.min(1200, Math.max(1, Number.isFinite(months) ? Math.trunc(months) : 1));
  if (p === 0) return { monthly: 0, last: 0, totalInterest: 0, totalPaid: 0, months: n };

  const safeApr = Number.isFinite(aprBp) && aprBp > 0 ? Math.min(aprBp, 100_000) : 0;
  if (method === 'flat' || safeApr <= 0) {
    // Bunga flat setahun = pokok × tarif; pakai BigInt agar pokok besar (IDR) tidak overflow 2^53.
    const bpCenti = BigInt(Math.round(safeApr * 100));
    const interestBig = safeApr <= 0 ? BigInt(0) : (BigInt(p) * bpCenti * BigInt(n) + BigInt(6_000_000)) / BigInt(12_000_000);
    const interest = interestBig > BigInt(Number.MAX_SAFE_INTEGER - p) ? Number.MAX_SAFE_INTEGER - p : Number(interestBig);
    const total = p + interest;
    const monthly = Math.floor(total / n);
    const last = total - monthly * (n - 1);
    return { monthly, last, totalInterest: interest, totalPaid: total, months: n };
  }

  const r = safeApr / 10000 / 12;
  const rawPayment = Math.round((p * r) / (1 - Math.pow(1 + r, -n)));
  const payment = Number.isFinite(rawPayment) ? Math.min(rawPayment, Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
  let balance = p;
  let interestSum = 0;
  let last = payment;
  for (let k = 1; k <= n; k++) {
    const rawInt = Math.round(balance * r);
    const interest = Number.isFinite(rawInt) ? Math.min(rawInt, Number.MAX_SAFE_INTEGER - interestSum) : Number.MAX_SAFE_INTEGER - interestSum;
    interestSum += interest;
    const principalPart = k === n ? balance : Math.min(balance, Math.max(0, payment - interest));
    if (k === n) last = Math.min(Number.MAX_SAFE_INTEGER, principalPart + interest);
    balance -= principalPart;
  }
  const totalPaid = Math.min(Number.MAX_SAFE_INTEGER, p + interestSum);
  return { monthly: payment, last, totalInterest: Math.min(interestSum, Number.MAX_SAFE_INTEGER), totalPaid, months: n };
}
