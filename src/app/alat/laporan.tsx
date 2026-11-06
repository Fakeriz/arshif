import { FileDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip, EmptyState, Tabs } from '@/components/ui';
import { SectionLabel } from '@/features/planning/kit';
import { annualReportDocument } from '@/features/tools/documents';
import { GatedBody, ResultRow, TaxDisclaimer, ToolScreen, useFeatureGate, usePdfExportGate, usePdfShare } from '@/features/tools/kit';
import { categoryLabel, useI18n, type MsgKey } from '@/i18n';
import { monthName } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { annualReport, defaultTaxCountry, ptkpCode, type PtkpStatus, type TaxCountry } from '@/lib/tax';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/** Laporan pajak tahunan dari data transaksi (FR-TAX-3, Premium) + PDF Export. */
export default function AnnualTaxReport() {
  const { t } = useI18n();
  const gate = useFeatureGate('taxFull');
  return (
    <ToolScreen title={t('tools.report.title')}>
      <GatedBody gate={gate} reason={t('tools.report.reason')} lockedTitle={t('tools.report.lockedTitle')}>
        <Report />
      </GatedBody>
    </ToolScreen>
  );
}

function Report() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { state } = useStore();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [country, setCountry] = useState<TaxCountry>(() => defaultTaxCountry(state.mainCurrency, lang));
  const [married, setMarried] = useState(false);
  const [dependents, setDependents] = useState<PtkpStatus['dependents']>(0);
  const status: PtkpStatus = { married, dependents };
  const r = useMemo(() => annualReport(state.transactions, year, country, { married, dependents }), [state.transactions, year, country, married, dependents]);
  const money = (v: number) => formatMoney(v, r.currency);
  const pdf = usePdfShare();
  const exportGate = usePdfExportGate();
  const countryKey = country === 'ID' ? 'Id' : country === 'MY' ? 'My' : 'Tr';
  const empty = r.income === 0 && r.expense === 0;

  const exportPdf = async () => {
    if (!(await exportGate())) return;
    await pdf.run(() => annualReportDocument(r, { t, lang, owner: state.displayName ?? '', accent: colors.accent }), `Arshif-pajak-${year}-${country}`);
  };

  return (
    <>
      <View style={styles.chips} accessibilityLabel={t('tools.report.year')}>
        {[thisYear, thisYear - 1].map((y) => (
          <Chip key={y} label={String(y)} selected={year === y} onPress={() => setYear(y)} />
        ))}
      </View>
      <Tabs
        accessibilityLabel={t('tools.tax.country')}
        value={country}
        onChange={setCountry}
        items={[{ key: 'ID', label: t('tools.tax.countryId') }, { key: 'MY', label: t('tools.tax.countryMy') }, { key: 'TR', label: t('tools.tax.countryTr') }]}
      />
      {country === 'ID' && (
        <View style={styles.chips} accessibilityLabel={t('tools.tax.id.status', { code: ptkpCode(status) })}>
          <Chip label={t('tools.tax.id.single')} selected={!married} onPress={() => setMarried(false)} />
          <Chip label={t('tools.tax.id.married')} selected={married} onPress={() => setMarried(true)} />
          {([0, 1, 2, 3] as const).map((n) => (
            <Chip key={n} label={t('tools.report.dependents', { count: n })} selected={dependents === n} onPress={() => setDependents(n)} />
          ))}
        </View>
      )}

      {empty ? (
        <EmptyState title={t('tools.report.emptyTitle', { year })} message={t('tools.report.emptyMessage')} compact />
      ) : (
        <>
          <Card padding="lg">
            <AppText variant="caption" tone="secondary">
              {t('tools.report.incomeYear', { year })}
            </AppText>
            <AppText variant="amountHero" numeric adjustsFontSizeToFit numberOfLines={1}>
              {money(r.income)}
            </AppText>
            <View style={styles.lines}>
              <ResultRow label={t('tools.report.expense')} value={money(r.expense)} />
              <ResultRow label={t('tools.report.net')} value={money(r.income - r.expense)} strong />
            </View>
          </Card>

          <SectionLabel>{t('tools.report.estimate')}</SectionLabel>
          <Card padding="lg">
            <ResultRow label={t('tools.report.income')} value={money(r.income)} />
            {r.allowance > 0 && <ResultRow label={t(`tools.report.allowance${country}` as MsgKey)} value={money(r.allowance)} minus />}
            <ResultRow label={t('tools.report.taxable')} value={money(r.taxable)} />
            <ResultRow label={t('tools.report.taxEstimate')} value={money(r.tax)} strong />
            <AppText variant="caption" tone="secondary" style={styles.gapTop}>
              {t(`tools.report.basis${country}` as MsgKey)}
            </AppText>
            <AppText variant="caption" tone="muted">
              {t('tools.report.seeEstimator', { country: t(`tools.tax.country${countryKey}` as MsgKey) })}
            </AppText>
          </Card>

          <SectionLabel>{t('tools.report.byCategory')}</SectionLabel>
          <Card padding="md">
            {r.byCategory.length === 0 ? (
              <AppText variant="body" tone="secondary">
                {t('tools.report.noIncome')}
              </AppText>
            ) : (
              r.byCategory.map((c) => <ResultRow key={c.key} label={categoryLabel(t, c.key)} value={money(c.amount)} />)
            )}
          </Card>

          <SectionLabel>{t('tools.report.byMonth')}</SectionLabel>
          <Card padding="md">
            {r.months.map((m, i) =>
              m.income === 0 && m.expense === 0 ? null : (
                <View key={i} style={styles.month}>
                  <AppText variant="bodyStrong">{monthName(i + 1, lang)}</AppText>
                  <AppText variant="caption" tone="secondary" numeric>
                    {t('tools.report.monthLine', { income: money(m.income), expense: money(m.expense) })}
                  </AppText>
                </View>
              ),
            )}
          </Card>
          {r.skipped > 0 && (
            <AppText variant="caption" tone="warning">
              {t('tools.report.skipped', { count: r.skipped })}
            </AppText>
          )}
          <Button label={pdf.busy ? t('tools.pdf.making') : t('tools.report.exportPdf')} icon={FileDown} fullWidth loading={pdf.busy} disabled={pdf.busy} onPress={() => void exportPdf()} />
        </>
      )}
      <TaxDisclaimer />
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  lines: { marginTop: space.md },
  gapTop: { marginTop: space.sm },
  month: { paddingVertical: space.sm, gap: space.xxs },
});
