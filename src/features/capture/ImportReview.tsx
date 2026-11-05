import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, Checkbox, CurrencyText } from '@/components/ui';
import { sampleStatement } from '@/data/seed';
import type { Transaction } from '@/data/types';
import { shortDate } from '@/lib/dates';
import { findDuplicate } from '@/lib/dedupe';
import { categorizeStatementRow, prettifyDescription } from '@/lib/statement';
import { space } from '@/theme/tokens';

/** Review import PDF (FR-PDF-3): baris yang mirip transaksi yang sudah ada tidak dicentang secara default. */
export function ImportReview({ accountId, accountName, currency, existing, onImport }: { accountId: string; accountName: string; currency: string; existing: Transaction[]; onImport: (txs: Transaction[]) => void }) {
  const rows = useMemo(() => sampleStatement.rows.map((r) => ({ ...r, duplicate: findDuplicate(r, existing, accountId) !== null })), [existing, accountId]);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.id, !r.duplicate])));
  const count = rows.filter((r) => checked[r.id]).length;
  const dups = rows.filter((r) => r.duplicate).length;

  const submit = () => {
    onImport(
      rows.filter((r) => checked[r.id]).map((r, i) => ({
        id: `n-${Date.now().toString(36)}-${i}`, type: r.type, merchant: prettifyDescription(r.description),
        categoryKey: categorizeStatementRow(r.description, r.type), accountId, date: r.date, time: '',
        amount: r.amount, currency, source: 'import' as const,
      })),
    );
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="body" tone="secondary">
        {`${rows.length} baris terbaca untuk ${accountName}.${dups ? ` ${dups} baris mirip transaksi yang sudah ada, jadi tidak dicentang.` : ''}`}
      </AppText>
      <Card padding="md">
        {rows.map((r, i) => (
          <View key={r.id} style={[styles.row, i < rows.length - 1 && styles.rowGap]}>
            <Checkbox checked={!!checked[r.id]} onChange={(v) => setChecked((c) => ({ ...c, [r.id]: v }))} accessibilityLabel={`${prettifyDescription(r.description)}, ${shortDate(r.date)}`} />
            <View style={styles.text}>
              <AppText variant="bodyStrong" numberOfLines={2}>
                {prettifyDescription(r.description)}
              </AppText>
              <AppText variant="caption" tone="muted">
                {shortDate(r.date)}
              </AppText>
              {r.duplicate && <Badge label="Kemungkinan duplikat" tone="warning" />}
            </View>
            <View style={styles.amount}>
              <CurrencyText amount={r.amount} currency={currency} kind={r.type === 'income' ? 'income' : 'expense'} variant="bodyStrong" />
            </View>
          </View>
        ))}
      </Card>
      <Button label={count === 0 ? 'Pilih minimal satu baris' : `Import ${count} transaksi`} fullWidth disabled={count === 0} onPress={submit} />
      <AppText variant="caption" tone="muted" align="center">
        Import tidak menambah kuota automation. Kuota import terpakai 1 setelah berhasil.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, paddingVertical: space.sm },
  rowGap: {},
  text: { flex: 1, gap: space.xxs, minWidth: 0, paddingTop: space.sm },
  amount: { paddingTop: space.sm },
});
