import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AmountField, AppText, Button, Card, Chip, EmptyState, Input } from '@/components/ui';
import { sampleVoice } from '@/data/seed';
import type { Transaction } from '@/data/types';
import { DEMO_TODAY } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { AccountWithBalance } from '@/state/AppStore';
import { space } from '@/theme/tokens';

import { AccountPicker, categoriesFor } from '../transactions/pickers';

type Draft = { id: string; merchant: string; categoryKey: string; amount: number | null; accountId: string; hint: string | null };

/** Review Voice Log (FR-VOICE-3): satu kartu per transaksi, bisa diedit atau dibuang sebelum "Simpan semua". */
export function VoiceReview({ accounts, onSave }: { accounts: AccountWithBalance[]; onSave: (txs: Transaction[]) => void }) {
  const fallback = accounts[0];
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    sampleVoice.items.map((i) => ({
      id: i.id, merchant: i.merchant, categoryKey: i.categoryKey, amount: i.amount,
      accountId: i.accountId ?? fallback?.id ?? '',
      hint: i.accountId ? null : `Akun "${i.accountHint}" tidak ditemukan, memakai ${fallback?.name}.`,
    })),
  );
  const [tried, setTried] = useState(false);
  const patch = (id: string, p: Partial<Draft>) => setDrafts((l) => l.map((d) => (d.id === id ? { ...d, ...p } : d)));
  const invalid = drafts.some((d) => !d.amount || !d.merchant.trim());

  const save = () => {
    setTried(true);
    if (invalid || drafts.length === 0) return;
    onSave(
      drafts.map((d, i) => ({
        id: `n-${Date.now().toString(36)}-${i}`, type: 'expense', merchant: d.merchant.trim(), categoryKey: d.categoryKey,
        accountId: d.accountId, date: DEMO_TODAY, time: '09:30', amount: d.amount as number,
        currency: accounts.find((a) => a.id === d.accountId)?.currency ?? 'IDR', source: 'voice',
      })),
    );
  };

  if (drafts.length === 0) return <EmptyState title="Semua transaksi dibuang" message="Rekam ulang atau catat manual." />;

  return (
    <View style={styles.wrap}>
      <Card>
        <AppText variant="caption" tone="secondary">
          Yang kudengar
        </AppText>
        <AppText variant="body" style={styles.quote}>{`“${sampleVoice.transcript}”`}</AppText>
      </Card>
      {drafts.map((d, i) => (
        <Card key={d.id}>
          <View style={styles.head}>
            <AppText variant="h3">{`Transaksi ${i + 1}`}</AppText>
            <Button label="Buang" icon={Trash2} variant="ghost" size="sm" onPress={() => setDrafts((l) => l.filter((x) => x.id !== d.id))} />
          </View>
          <View style={styles.fields}>
            <Input label="Keterangan" value={d.merchant} onChangeText={(merchant) => patch(d.id, { merchant })} error={tried && !d.merchant.trim() ? 'Isi keterangan.' : undefined} />
            <AmountField label="Nominal" value={d.amount} currency={accounts.find((a) => a.id === d.accountId)?.currency ?? 'IDR'} onChange={(amount) => patch(d.id, { amount })} error={tried && !d.amount ? 'Isi nominal.' : undefined} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {categoriesFor('expense').map((c) => (
                <Chip key={c.key} label={c.label} selected={d.categoryKey === c.key} onPress={() => patch(d.id, { categoryKey: c.key })} />
              ))}
            </ScrollView>
            <AccountPicker label="Akun" accounts={accounts} value={d.accountId} onChange={(accountId) => patch(d.id, { accountId, hint: null })} />
            {d.hint && (
              <AppText variant="caption" tone="warning">
                {d.hint}
              </AppText>
            )}
          </View>
        </Card>
      ))}
      <Button label={`Simpan semua (${drafts.length})`} fullWidth onPress={save} />
      <AppText variant="caption" tone="muted" align="center">
        {`Total ${formatMoney(drafts.reduce((s, d) => s + (d.amount ?? 0), 0), 'IDR')}. Voice Log memakai 1 kuota automation.`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  quote: { marginTop: space.xs },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fields: { gap: space.lg, marginTop: space.md },
  chips: { gap: space.sm },
});
