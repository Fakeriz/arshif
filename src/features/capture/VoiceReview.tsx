import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { AmountField, AppText, Button, Card, EmptyState, Input, useSaveThen, VoicePlayer } from '@/components/ui';
import type { Transaction, TxPlace } from '@/data/types';
import { PlaceField, type PlaceGuess } from '@/features/places/PlaceField';
import { todayYmd } from '@/lib/dates';
import { tryConvert } from '@/lib/fx';
import { newId } from '@/lib/uuid';
import { useActiveAccountId, type AccountWithBalance } from '@/state/AppStore';
import { space } from '@/theme/tokens';

import type { VoiceResult } from '../../../supabase/functions/_shared/contracts';
import { AccountPicker, CategoryPicker } from '../transactions/pickers';
import { localHm } from './clock';

type Draft = VoiceResult['items'][number] & { key: string; amountEdit: number | null; hint: string | null; accountPick: string; place: TxPlace | null; guess?: PlaceGuess };

/** Review Voice Log (FR-VOICE-3): satu kartu per transaksi, bisa diedit atau dibuang sebelum "Simpan semua". */
export function VoiceReview({
  result,
  audioUri,
  durationSec,
  accounts,
  onSave,
  onRetry,
}: {
  result: VoiceResult;
  audioUri?: string;
  durationSec?: number;
  accounts: AccountWithBalance[];
  onSave: (txs: Transaction[]) => void;
  onRetry?: () => void;
}) {
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
        place: null,
        // Tempat yang diucapkan dicari; tanpa itu, GPS hanya untuk satu transaksi hari ini (posisi sekarang = tempat beli).
        guess: i.placeHint ? { query: i.placeHint, from: 'voice' as const } : result.items.length === 1 && i.date === todayYmd() ? { gps: true as const } : undefined,
        hint: known || !i.accountHint ? null : t('capture.voiceReview.accountNotFound', { hint: i.accountHint, account: fallback?.name ?? '' }),
      };
    }),
  );
  const [tried, setTried] = useState(false);
  const saving = useSaveThen();
  const patch = (key: string, p: Partial<Draft>) => setDrafts((l) => l.map((d) => (d.key === key ? { ...d, ...p } : d)));
  const invalid = drafts.some((d) => !d.amountEdit || !d.merchant.trim() || !d.accountPick);

  const save = () => {
    setTried(true);
    if (invalid || drafts.length === 0) return;
    const now = localHm();
    const txs = drafts.map((d) => {
      const acc = accounts.find((a) => a.id === d.accountPick);
      const accountAmount = acc && acc.currency !== d.currency ? (tryConvert(d.amountEdit as number, d.currency, acc.currency) ?? undefined) : undefined;
      return {
        id: newId(), type: d.type, merchant: d.merchant.trim(), categoryKey: d.categoryKey, accountId: d.accountPick,
        // Jam yang diucapkan ("jam 8 pagi"); tidak disebut = jam sekarang.
        date: d.date, time: d.time ?? now, amount: d.amountEdit as number, currency: d.currency, accountAmount, note: d.note ?? undefined, source: 'voice' as const, place: d.place ?? undefined,
      };
    });
    saving.run(() => onSave(txs));
  };

  if (result.items.length === 0) {
    return (
      <EmptyState
        title={t('capture.voiceReview.noneTitle')}
        message={t('capture.voiceReview.noneMessage')}
        actionLabel={onRetry ? t('capture.voice.rerecord') : undefined}
        onAction={onRetry}
      />
    );
  }
  if (drafts.length === 0) {
    return (
      <EmptyState
        title={t('capture.voiceReview.allDiscardedTitle')}
        message={t('capture.voiceReview.allDiscardedMessage')}
        actionLabel={onRetry ? t('capture.voice.rerecord') : undefined}
        onAction={onRetry}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      {audioUri ? (
        <VoiceClipPlayer uri={audioUri} transcript={result.transcript} durationSec={durationSec ?? 1} />
      ) : (
        <Card>
          <AppText variant="caption" tone="secondary">
            {t('capture.voiceReview.heard')}
          </AppText>
          <AppText variant="body" style={styles.quote}>{`“${result.transcript}”`}</AppText>
        </Card>
      )}
      {drafts.map((d, i) => (
        <Card key={d.key}>
          <View style={styles.head}>
            <AppText variant="h3" numberOfLines={1} style={styles.flex}>{t('capture.voiceReview.item', { n: i + 1 })}</AppText>
            <Button label={t('capture.voiceReview.discard')} icon={Trash2} variant="ghost" size="sm" onPress={() => setDrafts((l) => l.filter((x) => x.key !== d.key))} />
          </View>
          <View style={styles.fields}>
            <Input label={t('capture.voiceReview.description')} value={d.merchant} onChangeText={(merchant) => patch(d.key, { merchant })} error={tried && !d.merchant.trim() ? t('capture.voiceReview.descriptionError') : undefined} />
            <AmountField label={t('common.amount')} value={d.amountEdit} currency={d.currency} onChange={(amountEdit) => patch(d.key, { amountEdit })} error={tried && !d.amountEdit ? t('capture.voiceReview.amountError') : undefined} />
            <CategoryPicker type={d.type} value={d.categoryKey} onChange={(categoryKey) => patch(d.key, { categoryKey: categoryKey as Draft['categoryKey'] })} />
            <AccountPicker label={t('capture.voiceReview.account')} accounts={accounts} value={d.accountPick} onChange={(accountPick) => patch(d.key, { accountPick, hint: null })} />
            {d.hint && (
              <AppText variant="caption" tone="warning">
                {d.hint}
              </AppText>
            )}
            <PlaceField value={d.place} onChange={(place) => patch(d.key, { place })} guess={d.guess} />
          </View>
        </Card>
      ))}
      <Button label={saving.done ? t('common.ui.saved') : t('capture.voiceReview.saveAll', { count: drafts.length })} done={saving.done} fullWidth onPress={save} />
      <AppText variant="caption" tone="muted" align="center">
        {t('capture.voiceReview.footer')}
      </AppText>
    </View>
  );
}

function VoiceClipPlayer({ uri, transcript, durationSec }: { uri: string; transcript: string; durationSec: number }) {
  const t = useT();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const total = status.duration > 0 ? status.duration : durationSec;
  const progress = total > 0 ? Math.max(0, Math.min(1, status.currentTime / total)) : 0;

  const onToggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (total > 0 && status.currentTime >= total - 0.1)) {
      void player.seekTo(0).catch(() => undefined);
    }
    player.play();
  };

  return (
    <Card>
      <VoicePlayer
        title={t('capture.voiceReview.heard')}
        subtitle={`“${transcript}”`}
        playing={status.playing}
        onToggle={onToggle}
        progress={progress}
        durationSec={total}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  quote: { marginTop: space.xs },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  fields: { gap: space.lg, marginTop: space.md },
});
