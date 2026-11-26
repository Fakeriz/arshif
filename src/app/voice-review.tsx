import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

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
  // Simpan menunggu 450 ms (centang "Tersimpan"); pengguna yang sudah kembali sendiri tidak dipindah lagi.
  const navigation = useNavigation();
  const t = useT();
  const { show } = useToast();
  const { dispatch } = useStore();
  const { accounts } = useLedger();
  // Ketukan ganda sebelum navigasi selesai: tiap ketukan membuat id baru, jadi yang kedua diabaikan.
  const saved = useRef(false);
  const [data] = useState(() => peekHandoff('voice'));

  useEffect(() => {
    return () => {
      if (!saved.current) clearHandoff('voice');
    };
  }, []);

  return (
    <Screen>
      <ScreenHeader title={t('capture.voiceReview.title')} />
      {data ? (
        <VoiceReview
          result={data.result}
          audioUri={data.audioUri}
          durationSec={data.durationSec}
          accounts={accounts}
          onRetry={() => {
            clearHandoff('voice');
            router.replace('/voice');
          }}
          onSave={(txs) => {
            if (saved.current) return;
            saved.current = true;
            // Kuota automation sudah dipotong server saat suara berhasil dipahami; ini hanya menyamakan angka di layar.
            dispatch({ type: 'tx/addMany', txs });
            clearHandoff('voice');
            show({ tone: 'success', title: t('capture.voiceReview.savedTitle', { count: txs.length }), message: t('capture.voiceReview.savedMessage') });
            if (navigation.isFocused()) router.replace('/transaksi');
          }}
        />
      ) : (
        <EmptyState title={t('capture.voiceReview.missingTitle')} message={t('capture.voiceReview.missingMessage')} actionLabel={t('capture.voice.title')} onAction={() => router.replace('/voice')} />
      )}
    </Screen>
  );
}
