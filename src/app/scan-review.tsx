import { useRouter } from 'expo-router';

import { useT } from '@/i18n';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { useToast } from '@/components/ui';
import { ScanReview } from '@/features/capture/ScanReview';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';

export default function ScanReviewScreen() {
  const router = useRouter();
  const t = useT();
  const { show } = useToast();
  const { dispatch } = useStore();
  const { accounts } = useLedger();
  return (
    <Screen glow={false}>
      <ScreenHeader title={t('capture.scanReview.title')} />
      <ScanReview
        accounts={accounts}
        onRetake={() => router.replace('/scan')}
        onSave={(tx) => {
          dispatch({ type: 'tx/add', tx, consumes: 'scan' });
          show({ tone: 'success', title: t('capture.scanReview.savedTitle'), message: t('capture.scanReview.savedMessage', { merchant: tx.merchant, amount: formatMoney(tx.amount, tx.currency) }) });
          router.replace('/transaksi');
        }}
      />
    </Screen>
  );
}
