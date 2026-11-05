import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { EmptyState, useToast } from '@/components/ui';
import { clearHandoff, peekHandoff } from '@/features/capture/handoff';
import { VoiceReview } from '@/features/capture/VoiceReview';
import { useT } from '@/i18n';
import { useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';

export default function VoiceReviewScreen() {
  const router = useRouter();
  const t = useT();
  const { show } = useToast();
  const { dispatch } = useStore();
  const { accounts } = useLedger();
  const [data] = useState(() => peekHandoff('voice'));

  return (
    <Screen glow={false}>
      <ScreenHeader title={t('capture.voiceReview.title')} />
      {data ? (
        <VoiceReview
          result={data.result}
          accounts={accounts}
          onSave={(txs) => {
            // Kuota automation sudah dipotong server saat suara berhasil dipahami; ini hanya menyamakan angka di layar.
            dispatch({ type: 'tx/addMany', txs });
            clearHandoff('voice');
            show({ tone: 'success', title: t('capture.voiceReview.savedTitle', { count: txs.length }), message: t('capture.voiceReview.savedMessage') });
            router.replace('/transaksi');
          }}
        />
      ) : (
        <EmptyState title={t('capture.voiceReview.missingTitle')} message={t('capture.voiceReview.missingMessage')} actionLabel={t('capture.voice.title')} onAction={() => router.replace('/voice')} />
      )}
    </Screen>
  );
}
