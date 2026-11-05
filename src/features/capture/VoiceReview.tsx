import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { AmountField, AppText, Button, Card, EmptyState, Input } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { newId } from '@/lib/uuid';
import { useActiveAccountId, type AccountWithBalance } from '@/state/AppStore';
import { space } from '@/theme/tokens';

import type { VoiceResult } from '../../../supabase/functions/_shared/contracts';
import { AccountPicker, CategoryPicker } from '../transactions/pickers';
import { localHm } from './clock';

type Draft = VoiceResult['items'][number] & { key: string; amountEdit: number | null; hint: string | null; accountPick: string };

/** Review Voice Log (FR-VOICE-3): satu kartu per transaksi, bisa diedit atau dibuang sebelum "Simpan semua". */
export function VoiceReview({ result, accounts, onSave }: { result: VoiceResult; accounts: AccountWithBalance[]; onSave: (txs: Transaction[]) => void }) {
  const t = useT();
  const activeId = useActiveAccountId();
  const fallback = accounts.find((a) => a.id === activeId) ?? accounts[0];
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    result.items.map((i) => {
      // Akun dari AI hanya dipakai bila memang milik pengguna; selain itu akun default (FR-VOICE-3).
      const known = i.accountId && accounts.some((a) => a.id === i.accountId) ? i.accountId : null;
      return {
        ...i,
        key: newId(),
        amountEdit: i.amount,
        accountPick: known ?? fallback?.id ?? '',
        hint: known || !i.accountHint ? null : t('capture.voiceReview.accountNotFound', { hint: i.accountHint, account: fallback?.name ?? '' }),
      };
    }),
  );
  const [tried, setTried] = useState(false);
  const patch = (key: string, p: Partial<Draft>) => setDrafts((l) => l.map((d) => (d.key === key ? { ...d, ...p } : d)));
  const invalid = drafts.some((d) => !d.amountEdit || !d.merchant.trim() || !d.accountPick);

  const save = () => {
    setTried(true);
    if (invalid || drafts.length === 0) return;
    const time = localHm();
    onSave(
      drafts.map((d) => ({
        id: newId(), type: d.type, merchant: d.merchant.trim(), categoryKey: d.categoryKey, accountId: d.accountPick,
        date: d.date, time, amount: d.amountEdit as number, currency: d.currency, note: d.note ?? undefined, source: 'voice',
      })),
    );
  };

  if (result.items.length === 0) return <EmptyState title={t('capture.voiceReview.noneTitle')} message={t('capture.voiceReview.noneMessage')} />;
  if (drafts.length === 0) return <EmptyState title={t('capture.voiceReview.allDiscardedTitle')} message={t('capture.voiceReview.allDiscardedMessage')} />;

  return (
    <View style={styles.wrap}>
      <Card>
        <AppText variant="caption" tone="secondary">
          {t('capture.voiceReview.heard')}
        </AppText>
        <AppText variant="body" style={styles.quote}>{`“${result.transcript}”`}</AppText>
      </Card>
      {drafts.map((d, i) => (
        <Card key={d.key}>
          <View style={styles.head}>
            <AppText variant="h3" numberOfLines={1} style={styles.flex}>{t('capture.voiceReview.item', { n: i + 1 })}</AppText>
            <Button label={t('capture.voiceReview.discard')} icon={Trash2} variant="ghost" size="sm" onPress={() => setDrafts((l) => l.filter((x) => x.key !== d.key))} />
          </View>
          <View style={styles.fields}>
            <Input label={t('capture.voiceReview.description')} value={d.merchant} onChangeText={(merchant) => patch(d.key, { merchant })} error={tried && !d.merchant.trim() ? t('capture.voiceReview.descriptionError') : undefined} />
            <AmountField label={t('common.amount')} value={d.amountEdit} currency={d.currency} onChange={(amountEdit) => patch(d.key, { amountEdit })} error={tried && !d.amountEdit ? t('capture.voiceReview.amountError') : undefined} />
            <CategoryPicker type={d.type} scroll value={d.categoryKey} onChange={(categoryKey) => patch(d.key, { categoryKey: categoryKey as Draft['categoryKey'] })} />
            <AccountPicker label={t('capture.voiceReview.account')} accounts={accounts} value={d.accountPick} onChange={(accountPick) => patch(d.key, { accountPick, hint: null })} />
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
        {t('capture.voiceReview.footer')}
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
});
