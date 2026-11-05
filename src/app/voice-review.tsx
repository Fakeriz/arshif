import { useRouter } from 'expo-router';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { useToast } from '@/components/ui';
import { VoiceReview } from '@/features/capture/VoiceReview';
import { useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';

export default function VoiceReviewScreen() {
  const router = useRouter();
  const { show } = useToast();
  const { dispatch } = useStore();
  const { accounts } = useLedger();
  return (
    <Screen glow={false}>
      <ScreenHeader title="Cek hasil Voice Log" />
      <VoiceReview
        accounts={accounts}
        onSave={(txs) => {
          dispatch({ type: 'tx/addMany', txs, consumes: 'automation' });
          show({ tone: 'success', title: `${txs.length} transaksi tersimpan`, message: 'Voice Log memakai 1 kuota automation.' });
          router.replace('/transaksi');
        }}
      />
    </Screen>
  );
}
