import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, Checkbox, CurrencyText, EmptyState } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { useI18n } from '@/i18n';
import { shortDate } from '@/lib/dates';
import { findDuplicate } from '@/lib/dedupe';
import { prettifyDescription } from '@/lib/statement';
import { newId } from '@/lib/uuid';
import { space } from '@/theme/tokens';

import type { ImportResult } from '../../../supabase/functions/_shared/contracts';

type Props = { result: ImportResult; accountId: string; accountName: string; existing: Transaction[]; onImport: (txs: Transaction[]) => void };

/** Review import PDF (FR-PDF-3): baris yang mirip transaksi yang sudah ada tidak dicentang secara default (FR-PDF-2). */
export function ImportReview({ result, accountId, accountName, existing, onImport }: Props) {
  const { t, lang } = useI18n();
  const rows = useMemo(
    () => result.rows.map((r, i) => ({ ...r, key: String(i), duplicate: findDuplicate(r, existing, accountId) !== null })),
    [result.rows, existing, accountId],
  );
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.key, !r.duplicate])));
  const count = rows.filter((r) => checked[r.key]).length;
  const dups = rows.filter((r) => r.duplicate).length;

  if (rows.length === 0) return <EmptyState title={t('capture.importReview.noneTitle')} message={t('capture.importReview.noneMessage')} />;

  const submit = () => {
    onImport(
      rows.filter((r) => checked[r.key]).map((r) => ({
        id: newId(), type: r.type, merchant: prettifyDescription(r.description), categoryKey: r.categoryKey, accountId,
        date: r.date, time: '00:00', amount: r.amount, currency: r.currency, source: 'import' as const,
      })),
    );
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="body" tone="secondary">
        {t('capture.importReview.rowsRead', { count: rows.length, account: accountName }) + (dups ? ` ${t('capture.importReview.dupsSkipped', { count: dups })}` : '')}
      </AppText>
      <Card padding="md">
        {rows.map((r) => (
          <View key={r.key} style={styles.row}>
            <Checkbox checked={!!checked[r.key]} onChange={(v) => setChecked((c) => ({ ...c, [r.key]: v }))} accessibilityLabel={`${prettifyDescription(r.description)}, ${shortDate(r.date, lang)}`} />
            <View style={styles.text}>
              <AppText variant="bodyStrong" numberOfLines={2}>
                {prettifyDescription(r.description)}
              </AppText>
              <AppText variant="caption" tone="muted">
                {shortDate(r.date, lang)}
              </AppText>
              {r.duplicate && <Badge label={t('capture.importReview.duplicate')} tone="warning" />}
            </View>
            <View style={styles.amount}>
              <CurrencyText amount={r.amount} currency={r.currency} kind={r.type === 'income' ? 'income' : 'expense'} variant="bodyStrong" />
            </View>
          </View>
        ))}
      </Card>
      <Button label={count === 0 ? t('capture.importReview.pickOne') : t('capture.importReview.submit', { count })} fullWidth disabled={count === 0} onPress={submit} />
      <AppText variant="caption" tone="muted" align="center">
        {t('capture.importReview.footer')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, paddingVertical: space.sm },
  text: { flex: 1, gap: space.xxs, minWidth: 0, paddingTop: space.sm },
  amount: { paddingTop: space.sm },
});
