import { useRouter } from 'expo-router';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { useToast } from '@/components/ui';
import { ScanReview } from '@/features/capture/ScanReview';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';

export default function ScanReviewScreen() {
  const router = useRouter();
  const { show } = useToast();
  const { dispatch } = useStore();
  const { accounts } = useLedger();
  return (
    <Screen glow={false}>
      <ScreenHeader title="Cek hasil scan" />
      <ScanReview
        accounts={accounts}
        onRetake={() => router.replace('/scan')}
        onSave={(tx) => {
          dispatch({ type: 'tx/add', tx, consumes: 'scan' });
          show({ tone: 'success', title: 'Struk tersimpan', message: `${tx.merchant} · ${formatMoney(tx.amount, tx.currency)}. Kuota scan terpakai 1.` });
          router.replace('/transaksi');
        }}
      />
    </Screen>
  );
}
