import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { SectionLabel } from '@/features/planning/kit';
import { useI18n, type MsgKey } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { bpText, type RateRow, type TaxLine, type TaxResult } from '@/lib/tax';
import { space } from '@/theme/tokens';

import { ResultRow } from './kit';

export const decimalFor = (lang: string): ',' | '.' => (lang === 'id' || lang === 'tr' ? ',' : '.');

/** Label baris rincian: tarif (bp) ditulis sebagai persen sesuai bahasa. */
export function useLineLabel() {
  const { t, lang } = useI18n();
  return (l: TaxLine) => {
    const vars = { ...l.vars };
    if (typeof vars.rate === 'number') vars.rate = bpText(vars.rate, decimalFor(lang));
    return t(`tools.tax.line.${l.key}` as MsgKey, vars);
  };
}

export function rateRowText(r: RateRow, currency: string, upToWord: string, aboveWord: string): string {
  if (r.to === null) return `${aboveWord} ${formatMoney(r.from, currency)}`;
  return r.from === 0 ? `${upToWord} ${formatMoney(r.to, currency)}` : `${formatMoney(r.from, currency)} – ${formatMoney(r.to, currency)}`;
}

/** Hasil estimasi: angka utama, rincian perhitungan, tabel tarif yang dipakai, dan asumsi. */
export function TaxResultCard({ result }: { result: TaxResult }) {
  const { t, lang } = useI18n();
  const label = useLineLabel();
  const money = (v: number) => formatMoney(v, result.currency);
  return (
    <>
      <Card padding="lg">
        <AppText variant="caption" tone="secondary">
          {t(result.headlineKey as MsgKey)}
        </AppText>
        <AppText variant="amountHero" numeric adjustsFontSizeToFit numberOfLines={1} aria-live="polite">
          {money(result.headline)}
        </AppText>
        <View style={styles.lines}>
          {result.lines.map((l) => (
            <ResultRow key={l.key} label={label(l)} value={money(l.amount)} strong={l.strong} minus={l.minus} />
          ))}
        </View>
      </Card>
      <SectionLabel>{t('tools.tax.ratesTitle', { year: 2026 })}</SectionLabel>
      <Card padding="md">
        {result.rates.map((r) => (
          <ResultRow key={r.from} label={rateRowText(r, result.currency, t('tools.tax.upTo'), t('tools.tax.above'))} value={`${bpText(r.bp, decimalFor(lang))}%`} />
        ))}
        <AppText variant="caption" tone="muted" style={styles.source}>
          {t(`tools.tax.${result.country === 'ID' ? 'id' : result.country === 'MY' ? 'my' : 'tr'}.source` as MsgKey)}
        </AppText>
      </Card>
      <View style={styles.notes}>
        {result.notes.map((n) => (
          <AppText key={n} variant="caption" tone="secondary">
            {`• ${t(n as MsgKey)}`}
          </AppText>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  lines: { marginTop: space.md },
  source: { marginTop: space.sm },
  notes: { gap: space.xs },
});
