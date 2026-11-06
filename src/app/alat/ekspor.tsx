import { FileDown } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip } from '@/components/ui';
import { localYmd } from '@/features/capture/clock';
import { DateField, isYmd } from '@/features/planning/kit';
import { historyDocument, monthlyReportDocument, monthlySummary } from '@/features/tools/documents';
import { GatedBody, ToolScreen, useFeatureGate, usePdfShare } from '@/features/tools/kit';
import { useI18n } from '@/i18n';
import { monthName } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/** "YYYY-MM" untuk n bulan ke belakang dari bulan ini. */
function recentMonths(n: number): string[] {
  const d = new Date();
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
  });
}

/** PDF Export (FR-TAX-3, Premium): laporan bulanan dan riwayat transaksi. Laporan pajak ada di layarnya sendiri. */
export default function PdfExport() {
  const { t } = useI18n();
  const gate = useFeatureGate('pdfExport');
  return (
    <ToolScreen title={t('tools.export.title')}>
      <GatedBody gate={gate} reason={t('tools.export.reason')} lockedTitle={t('tools.export.lockedTitle')}>
        <Exports />
      </GatedBody>
    </ToolScreen>
  );
}

function Exports() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { state } = useStore();
  const months = recentMonths(6);
  const [month, setMonth] = useState(months[0]);
  const today = localYmd();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const monthly = usePdfShare();
  const history = usePdfShare();
  const ctx = { t, lang, owner: state.displayName ?? '', accent: colors.accent };
  const main = state.mainCurrency;
  const s = monthlySummary(state.transactions, month, main);
  const rangeOk = isYmd(from) && isYmd(to) && from <= to;
  const inRange = rangeOk ? state.transactions.filter((x) => x.date >= from && x.date <= to).length : 0;
  const label = (m: string) => `${monthName(Number(m.slice(5, 7)), lang)} ${m.slice(0, 4)}`;

  return (
    <>
      <Card padding="lg">
        <View style={styles.block}>
          <AppText variant="h3" accessibilityRole="header">
            {t('tools.export.monthlyTitle')}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {t('tools.export.monthlyHint', { currency: main })}
          </AppText>
          <View style={styles.chips} accessibilityLabel={t('tools.export.pickMonth')}>
            {months.map((m) => (
              <Chip key={m} label={label(m)} selected={m === month} onPress={() => setMonth(m)} />
            ))}
          </View>
          <AppText variant="body" tone="secondary" numeric>
            {s.count === 0 ? t('tools.export.monthEmpty') : t('tools.export.monthPreview', { count: s.count, income: formatMoney(s.income, main), expense: formatMoney(s.expense, main) })}
          </AppText>
          <Button
            label={monthly.busy ? t('tools.pdf.making') : t('tools.export.monthlyCta', { month: label(month) })}
            icon={FileDown}
            fullWidth
            loading={monthly.busy}
            disabled={monthly.busy}
            onPress={() => void monthly.run(() => monthlyReportDocument(state.transactions, month, main, ctx), `Arshif-laporan-${month}`)}
          />
        </View>
      </Card>

      <Card padding="lg">
        <View style={styles.block}>
          <AppText variant="h3" accessibilityRole="header">
            {t('tools.export.historyTitle')}
          </AppText>
          <DateField label={t('tools.export.from')} value={from} onChange={setFrom} error={!isYmd(from)} />
          <DateField label={t('tools.export.to')} value={to} onChange={setTo} error={!isYmd(to)} />
          {isYmd(from) && isYmd(to) && from > to && (
            <AppText variant="caption" tone="negative">
              {t('tools.export.rangeError')}
            </AppText>
          )}
          <AppText variant="body" tone="secondary">
            {rangeOk ? t('tools.export.rangePreview', { count: inRange }) : ''}
          </AppText>
          <Button
            label={history.busy ? t('tools.pdf.making') : t('tools.export.historyCta')}
            icon={FileDown}
            fullWidth
            loading={history.busy}
            disabled={history.busy || !rangeOk}
            onPress={() => void history.run(() => historyDocument(state.transactions, state.accounts, from, to, ctx), `Arshif-riwayat-${from}-${to}`)}
          />
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
