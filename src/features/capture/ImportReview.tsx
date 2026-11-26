import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, Checkbox, CurrencyText, EmptyState, Toggle, useSaveThen } from '@/components/ui';
import type { Account, Transaction } from '@/data/types';
import { useI18n } from '@/i18n';
import { shortDate } from '@/lib/dates';
import { findDuplicate } from '@/lib/dedupe';
import { formatMoney } from '@/lib/money';
import { buildReconciliationTx, prettifyDescription, reconcileStatement } from '@/lib/statement';
import { newId } from '@/lib/uuid';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, space } from '@/theme/tokens';

import type { ImportResult } from '../../../supabase/functions/_shared/contracts';

type Props = {
  result: ImportResult;
  accountId: string;
  accountName: string;
  account?: Account;
  existing: Transaction[];
  onImport(txs: Transaction[]): void;
};

/** Review import PDF (FR-PDF-3): baris yang mirip transaksi yang sudah ada tidak dicentang secara default (FR-PDF-2). */
const PAGE_ROWS = 100;

export function ImportReview({ result, accountId, accountName, account, existing, onImport }: Props) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const rows = useMemo(() => {
    const usedIds = new Set<string>();
    return result.rows.map((r, i) => ({ ...r, key: String(i), duplicate: findDuplicate(r, existing, accountId, usedIds) !== null }));
  }, [result.rows, existing, accountId]);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.key, !r.duplicate])));
  const [adjustBalance, setAdjustBalance] = useState(false);
  const selectedRows = useMemo(() => rows.filter((r) => checked[r.key]), [rows, checked]);
  const recon = useMemo(() => reconcileStatement(result, selectedRows, account, existing), [result, selectedRows, account, existing]);
  const count = selectedRows.length;
  const dups = rows.filter((r) => r.duplicate).length;
  const willAdjust = Boolean(adjustBalance && recon && !recon.matched);
  const submitCount = count + (willAdjust ? 1 : 0);
  const saving = useSaveThen();
  // Rekening koran bisa 1000 baris: render bertahap agar layar tidak membeku saat dibuka.
  const [shown, setShown] = useState(PAGE_ROWS);

  if (rows.length === 0) return <EmptyState title={t('capture.importReview.noneTitle')} message={t('capture.importReview.noneMessage')} />;

  const submit = () => {
    const txs: Transaction[] = selectedRows.map((r) => ({
      id: newId(), type: r.type, merchant: prettifyDescription(r.description), categoryKey: r.categoryKey, accountId,
      date: r.date, time: r.time ?? '00:00', amount: r.amount, currency: r.currency, source: 'import' as const,
    }));
    if (willAdjust && recon) {
      const adj = buildReconciliationTx(recon, accountId, t('capture.importReview.adjustMerchant'), newId());
      if (adj) txs.push(adj);
    }
    saving.run(() => onImport(txs));
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="body" tone="secondary">
        {t('capture.importReview.rowsRead', { count: rows.length, account: accountName }) + (dups ? ` ${t('capture.importReview.dupsSkipped', { count: dups })}` : '')}
      </AppText>
      {recon !== null && (
        <Card padding="md">
          <View style={styles.reconWrap}>
            <View style={styles.reconHead}>
              <AppText variant="bodyStrong" style={styles.flex}>
                {t('capture.importReview.reconcileTitle')}
              </AppText>
              <Badge label={recon.matched ? t('capture.importReview.reconcileMatched') : t('capture.importReview.reconcileDiff')} tone={recon.matched ? 'positive' : 'warning'} />
            </View>
            <View style={styles.reconRow}>
              <AppText variant="caption" tone="secondary" style={styles.flex}>
                {t('capture.importReview.statementClosing', { date: shortDate(recon.asOfDate, lang) })}
              </AppText>
              <AppText variant="body" numeric>
                {formatMoney(recon.closingBalance, recon.currency)}
              </AppText>
            </View>
            <View style={styles.reconRow}>
              <AppText variant="caption" tone="secondary" style={styles.flex}>
                {t('capture.importReview.projectedBalance')}
              </AppText>
              <AppText variant="body" numeric>
                {formatMoney(recon.projectedBalance, recon.currency)}
              </AppText>
            </View>
            {!recon.matched && (
              <>
                <View style={styles.reconRow}>
                  <AppText variant="caption" tone="secondary" style={styles.flex}>
                    {t('common.difference')}
                  </AppText>
                  <CurrencyText amount={Math.abs(recon.difference)} currency={recon.currency} kind={recon.difference > 0 ? 'income' : 'expense'} variant="bodyStrong" />
                </View>
                <View style={[styles.adjustRow, { borderTopColor: colors.border }]}>
                  <View style={styles.adjustText}>
                    <AppText variant="bodyStrong">{t('capture.importReview.adjustToggle')}</AppText>
                    <AppText variant="caption" tone="muted">
                      {t('capture.importReview.adjustHint', { amount: formatMoney(recon.difference, recon.currency, 'always'), date: shortDate(recon.asOfDate, lang) })}
                    </AppText>
                  </View>
                  <Toggle value={adjustBalance} onChange={setAdjustBalance} accessibilityLabel={t('capture.importReview.adjustToggle')} />
                </View>
              </>
            )}
          </View>
        </Card>
      )}
      <Card padding="md">
        {rows.slice(0, shown).map((r) => (
          <View key={r.key} style={styles.row}>
            <Checkbox checked={!!checked[r.key]} onChange={(v) => setChecked((c) => ({ ...c, [r.key]: v }))} accessibilityLabel={`${prettifyDescription(r.description)}, ${shortDate(r.date, lang)}`} />
            <View style={styles.text}>
              <AppText variant="bodyStrong" numberOfLines={2}>
                {prettifyDescription(r.description)}
              </AppText>
              <AppText variant="caption" tone="muted">
                {r.time ? `${shortDate(r.date, lang)} · ${r.time}` : shortDate(r.date, lang)}
              </AppText>
              {r.duplicate && <Badge label={t('capture.importReview.duplicate')} tone="warning" />}
            </View>
            <View style={styles.amount}>
              <CurrencyText amount={r.amount} currency={r.currency} kind={r.type === 'income' ? 'income' : 'expense'} variant="bodyStrong" />
            </View>
          </View>
        ))}
      </Card>
      {rows.length > shown && (
        <Button label={t('capture.importReview.showMore', { count: Math.min(PAGE_ROWS, rows.length - shown) })} variant="secondary" fullWidth onPress={() => setShown((n) => n + PAGE_ROWS)} />
      )}
      <Button label={saving.done ? t('common.ui.saved') : submitCount === 0 ? t('capture.importReview.pickOne') : t('capture.importReview.submit', { count: submitCount })} done={saving.done} fullWidth disabled={submitCount === 0} onPress={submit} />
      <AppText variant="caption" tone="muted" align="center">
        {t('capture.importReview.footer')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  reconWrap: { gap: space.sm },
  reconHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  reconRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  adjustRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: layout.hairline, paddingTop: space.sm },
  adjustText: { flex: 1, minWidth: 0, gap: space.xxs },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, paddingVertical: space.sm },
  text: { flex: 1, gap: space.xxs, minWidth: 0, paddingTop: space.sm },
  amount: { paddingTop: space.sm },
});
