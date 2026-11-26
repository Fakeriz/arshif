import type { Account, Transaction } from '@/data/types';

import { tryConvert } from './fx';
import { currencyMeta } from './money';
import { sortNewestFirst } from './transactions';

export type TxFxBasis = {
  kind: 'remittance' | 'spend' | 'income';
  fromAmount: number;
  fromCurrency: string;
  toAmount: number;
  toCurrency: string;
  /** Rasio kurs efektif dalam satuan utama (>= 1 memakai 4 desimal, < 1 memakai 6 desimal). */
  effectiveRate: string;
  /** Ekuivalen dalam `toCurrency` memakai kurs referensi hari ini, atau null bila kurs tidak tersedia. */
  liveToAmount: number | null;
  /** Selisih menguntungkan (+) atau merugikan (-) dalam minor unit `toCurrency` vs kurs hari ini. */
  fxDeltaTo: number | null;
};

export type FxBasisSummary = {
  totalCount: number;
  remittanceCount: number;
  totalVolumeMain: number;
  netDeltaMain: number;
  recent: { tx: Transaction; basis: TxFxBasis }[];
};

export function formatEffectiveRate(fromAmount: number, fromCurrency: string, toAmount: number, toCurrency: string): string {
  const denom = fromAmount / 10 ** currencyMeta(fromCurrency).exponent;
  const numer = toAmount / 10 ** currencyMeta(toCurrency).exponent;
  if (!(denom > 0) || !Number.isFinite(denom) || !Number.isFinite(numer)) return '0.0000';
  const ratio = numer / denom;
  return ratio >= 1 ? ratio.toFixed(4) : ratio.toFixed(6);
}

/** Hitung cost-basis kurs efektif transaksi/remitansi lintas mata uang dan bandingkan dengan kurs hari ini. */
export function txFxBasis(tx: Transaction, account?: Account, toAccount?: Account): TxFxBasis | null {
  if (tx.type === 'transfer') {
    if (!account || !toAccount || account.currency === toAccount.currency || !tx.toAmount || tx.toAmount <= 0) return null;
    const fromAmount = tx.accountAmount ?? tx.amount;
    if (!(fromAmount > 0)) return null;
    const fromCurrency = account.currency;
    const toCurrency = toAccount.currency;
    const toAmount = tx.toAmount;
    const liveToAmount = tryConvert(fromAmount, fromCurrency, toCurrency);
    const fxDeltaTo = liveToAmount !== null ? toAmount - liveToAmount : null;
    return {
      kind: 'remittance',
      fromAmount,
      fromCurrency,
      toAmount,
      toCurrency,
      effectiveRate: formatEffectiveRate(fromAmount, fromCurrency, toAmount, toCurrency),
      liveToAmount,
      fxDeltaTo,
    };
  }

  if (!account || account.currency === tx.currency || tx.accountAmount === undefined || tx.accountAmount <= 0 || tx.amount <= 0) {
    return null;
  }
  const fromAmount = tx.amount;
  const fromCurrency = tx.currency;
  const toAmount = tx.accountAmount;
  const toCurrency = account.currency;
  const liveToAmount = tryConvert(fromAmount, fromCurrency, toCurrency);
  const fxDeltaTo =
    liveToAmount === null ? null : tx.type === 'expense' ? liveToAmount - toAmount : toAmount - liveToAmount;

  return {
    kind: tx.type === 'income' ? 'income' : 'spend',
    fromAmount,
    fromCurrency,
    toAmount,
    toCurrency,
    effectiveRate: formatEffectiveRate(fromAmount, fromCurrency, toAmount, toCurrency),
    liveToAmount,
    fxDeltaTo,
  };
}

/** Ringkasan cost-basis kurs & remitansi lintas mata uang dalam mata uang utama. */
export function summarizeFxBasis(txs: Transaction[], accounts: Account[], mainCurrency: string): FxBasisSummary {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const recent: { tx: Transaction; basis: TxFxBasis }[] = [];
  let totalCount = 0;
  let remittanceCount = 0;
  let totalVolumeMain = 0;
  let netDeltaMain = 0;

  for (const tx of sortNewestFirst(txs)) {
    const basis = txFxBasis(tx, byId.get(tx.accountId), tx.toAccountId ? byId.get(tx.toAccountId) : undefined);
    if (!basis) continue;
    totalCount += 1;
    if (basis.kind === 'remittance') remittanceCount += 1;

    const vol =
      basis.toCurrency === mainCurrency
        ? basis.toAmount
        : (tryConvert(basis.toAmount, basis.toCurrency, mainCurrency, tx.date) ??
          tryConvert(basis.toAmount, basis.toCurrency, mainCurrency) ??
          0);
    totalVolumeMain += vol;

    if (basis.fxDeltaTo !== null && basis.fxDeltaTo !== 0) {
      const sign = basis.fxDeltaTo < 0 ? -1 : 1;
      const absDelta = Math.abs(basis.fxDeltaTo);
      const convertedDelta =
        basis.toCurrency === mainCurrency ? absDelta : tryConvert(absDelta, basis.toCurrency, mainCurrency);
      if (convertedDelta !== null) netDeltaMain += sign * convertedDelta;
    }

    if (recent.length < 5) recent.push({ tx, basis });
  }

  return { totalCount, remittanceCount, totalVolumeMain, netDeltaMain, recent };
}
