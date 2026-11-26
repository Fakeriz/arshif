import { FileDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip, EmptyState, Group, Tabs, Toggle } from '@/components/ui';
import { annualReportDocument, fiscalBundleDocument, invoiceFiscalSummary } from '@/features/tools/documents';
import { GatedBody, ResultRow, TaxDisclaimer, ToolScreen, useFeatureGate, usePdfExportGate, usePdfShare } from '@/features/tools/kit';
import { categoryLabel, useI18n, type MsgKey } from '@/i18n';
import { monthName } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { annualReport, defaultTaxCountry, ptkpCode, type PtkpStatus, type TaxCountry } from '@/lib/tax';
import { useStore } from '@/state/AppStore';
import { useInvoicesOptional } from '@/state/invoices';
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
  const invCtx = useInvoicesOptional();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [country, setCountry] = useState<TaxCountry>(() => defaultTaxCountry(state.mainCurrency, lang));
  const [married, setMarried] = useState(false);
  const [dependents, setDependents] = useState<PtkpStatus['dependents']>(0);
  const [includeInvoices, setIncludeInvoices] = useState(true);
  const status: PtkpStatus = { married, dependents };
  const r = useMemo(() => annualReport(state.transactions, year, country, { married, dependents }), [state.transactions, year, country, married, dependents]);
  const invSum = useMemo(() => invoiceFiscalSummary(invCtx?.invoices ?? [], year, r.currency), [invCtx?.invoices, year, r.currency]);
  const hasInvoices = invSum.rows.length > 0;
  const money = (v: number) => formatMoney(v, r.currency);
  const pdf = usePdfShare();
  const exportGate = usePdfExportGate();
  const countryKey = country === 'ID' ? 'Id' : country === 'MY' ? 'My' : 'Tr';
  const empty = r.income === 0 && r.expense === 0 && !hasInvoices;

  const exportPdf = async () => {
    if (!(await exportGate())) return;
    if (includeInvoices && hasInvoices) {
      await pdf.run(() => fiscalBundleDocument(r, invCtx?.invoices ?? [], { t, lang, owner: state.displayName ?? '' }), `Arshif-pajak-invoice-${year}-${country}`);
    } else {
      await pdf.run(() => annualReportDocument(r, { t, lang, owner: state.displayName ?? '' }), `Arshif-pajak-${year}-${country}`);
    }
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

          <Group label={t('tools.report.estimate')}>
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
          </Group>

          <Group label={t('tools.report.byCategory')}>
            <Card padding="md">
              {r.byCategory.length === 0 ? (
                <AppText variant="body" tone="secondary">
                  {t('tools.report.noIncome')}
                </AppText>
              ) : (
                r.byCategory.map((c) => <ResultRow key={c.key} label={categoryLabel(t, c.key)} value={money(c.amount)} />)
              )}
            </Card>
          </Group>

          <Group label={t('tools.report.byMonth')}>
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
          </Group>
          {hasInvoices && (
            <Group label={t('tools.report.invoiceSummary')}>
              <Card padding="lg">
                <ResultRow label={t('tools.report.invoicePaidCount')} value={String(invSum.paidCount)} />
                <ResultRow label={t('tools.report.invoicePaidSubtotal')} value={money(invSum.paidSubtotal)} />
                <ResultRow label={t('tools.report.invoiceOutputTax')} value={money(invSum.paidTax)} />
                <ResultRow label={t('tools.report.invoiceUnpaidTotal')} value={money(invSum.unpaidTotal)} />
                <ResultRow label={t('tools.report.invoicePaidTotal')} value={money(invSum.paidTotal)} strong />
                <View style={[styles.toggleRow, { borderTopColor: colors.border }]}>
                  <AppText variant="body" style={styles.flex}>
                    {t('tools.report.includeInvoices')}
                  </AppText>
                  <Toggle value={includeInvoices} onChange={setIncludeInvoices} accessibilityLabel={t('tools.report.includeInvoices')} />
                </View>
              </Card>
            </Group>
          )}
          {(r.skipped > 0 || invSum.skipped > 0) && (
            <AppText variant="caption" tone="warning">
              {r.skipped > 0
                ? t('tools.report.skipped', { count: r.skipped })
                : t('tools.report.skippedInvoices', { count: invSum.skipped })}
            </AppText>
          )}
          <Button
            label={
              pdf.busy
                ? t('tools.pdf.making')
                : includeInvoices && hasInvoices
                  ? t('tools.report.exportBundlePdf')
                  : t('tools.report.exportPdf')
            }
            icon={FileDown}
            fullWidth
            loading={pdf.busy}
            disabled={pdf.busy}
            onPress={() => void exportPdf()}
          />
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
});
