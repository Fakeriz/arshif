import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { categoryLabel, useT } from '@/i18n';
import { AmountField, AppText, Button, Card, Chip, EmptyState, Input } from '@/components/ui';
import { sampleVoice } from '@/data/seed';
import type { Transaction } from '@/data/types';
import { DEMO_TODAY } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useActiveAccountId, type AccountWithBalance } from '@/state/AppStore';
import { space } from '@/theme/tokens';

import { AccountPicker, categoriesFor } from '../transactions/pickers';

type Draft = { id: string; merchant: string; categoryKey: string; amount: number | null; accountId: string; hint: string | null };

/** Review Voice Log (FR-VOICE-3): satu kartu per transaksi, bisa diedit atau dibuang sebelum "Simpan semua". */
export function VoiceReview({ accounts, onSave }: { accounts: AccountWithBalance[]; onSave: (txs: Transaction[]) => void }) {
  const t = useT();
  const activeId = useActiveAccountId();
  const fallback = accounts.find((a) => a.id === activeId) ?? accounts[0];
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    sampleVoice.items.map((i) => ({
      id: i.id, merchant: i.merchant, categoryKey: i.categoryKey, amount: i.amount,
      accountId: i.accountId ?? fallback?.id ?? '',
      hint: i.accountId ? null : t('capture.voiceReview.accountNotFound', { hint: i.accountHint, account: fallback?.name ?? '' }),
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

  if (drafts.length === 0) return <EmptyState title={t('capture.voiceReview.allDiscardedTitle')} message={t('capture.voiceReview.allDiscardedMessage')} />;

  return (
    <View style={styles.wrap}>
      <Card>
        <AppText variant="caption" tone="secondary">
          {t('capture.voiceReview.heard')}
        </AppText>
        <AppText variant="body" style={styles.quote}>{`“${sampleVoice.transcript}”`}</AppText>
      </Card>
      {drafts.map((d, i) => (
        <Card key={d.id}>
          <View style={styles.head}>
            <AppText variant="h3" numberOfLines={1} style={styles.flex}>{t('capture.voiceReview.item', { n: i + 1 })}</AppText>
            <Button label={t('capture.voiceReview.discard')} icon={Trash2} variant="ghost" size="sm" onPress={() => setDrafts((l) => l.filter((x) => x.id !== d.id))} />
          </View>
          <View style={styles.fields}>
            <Input label={t('capture.voiceReview.description')} value={d.merchant} onChangeText={(merchant) => patch(d.id, { merchant })} error={tried && !d.merchant.trim() ? t('capture.voiceReview.descriptionError') : undefined} />
            <AmountField label={t('common.amount')} value={d.amount} currency={accounts.find((a) => a.id === d.accountId)?.currency ?? 'IDR'} onChange={(amount) => patch(d.id, { amount })} error={tried && !d.amount ? t('capture.voiceReview.amountError') : undefined} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {categoriesFor('expense').map((c) => (
                <Chip key={c.key} label={categoryLabel(t, c.key)} selected={d.categoryKey === c.key} onPress={() => patch(d.id, { categoryKey: c.key })} />
              ))}
            </ScrollView>
            <AccountPicker label={t('capture.voiceReview.account')} accounts={accounts} value={d.accountId} onChange={(accountId) => patch(d.id, { accountId, hint: null })} />
            {d.hint && (
              <AppText variant="caption" tone="warning">
                {d.hint}
              </AppText>
            )}
          </View>
        </Card>
      ))}
      <Button label={t('capture.voiceReview.saveAll', { count: drafts.length })} fullWidth onPress={save} />
      <AppText variant="caption" tone="muted" align="center">
        {t('capture.voiceReview.footer', { total: formatMoney(drafts.reduce((s, d) => s + (d.amount ?? 0), 0), 'IDR') })}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  quote: { marginTop: space.xs },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  fields: { gap: space.lg, marginTop: space.md },
  chips: { gap: space.sm },
});
