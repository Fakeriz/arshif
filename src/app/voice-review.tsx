import { useRouter } from 'expo-router';

import { useT } from '@/i18n';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { useToast } from '@/components/ui';
import { VoiceReview } from '@/features/capture/VoiceReview';
import { useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';

export default function VoiceReviewScreen() {
  const router = useRouter();
  const t = useT();
  const { show } = useToast();
  const { dispatch } = useStore();
  const { accounts } = useLedger();
  return (
    <Screen glow={false}>
      <ScreenHeader title={t('capture.voiceReview.title')} />
      <VoiceReview
        accounts={accounts}
        onSave={(txs) => {
          dispatch({ type: 'tx/addMany', txs, consumes: 'automation' });
          show({ tone: 'success', title: t('capture.voiceReview.savedTitle', { count: txs.length }), message: t('capture.voiceReview.savedMessage') });
          router.replace('/transaksi');
        }}
      />
    </Screen>
  );
}
