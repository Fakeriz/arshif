import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { EmptyState, useToast } from '@/components/ui';
import { ImportReview } from '@/features/capture/ImportReview';
import { useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';

export default function ImportReviewScreen() {
  const { akun } = useLocalSearchParams<{ akun?: string }>();
  const router = useRouter();
  const { show } = useToast();
  const { dispatch } = useStore();
  const { accounts, transactions } = useLedger();
  const account = accounts.find((a) => a.id === akun) ?? accounts[0];

  return (
    <Screen glow={false}>
      <ScreenHeader title="Cek hasil import" />
      {account ? (
        <ImportReview
          accountId={account.id}
          accountName={account.name}
          currency={account.currency}
          existing={transactions}
          onImport={(txs) => {
            dispatch({ type: 'tx/addMany', txs, consumes: 'importPdf' });
            show({ tone: 'success', title: `${txs.length} transaksi diimpor`, message: `Masuk ke ${account.name}.` });
            router.replace('/transaksi');
          }}
        />
      ) : (
        <EmptyState title="Belum ada akun" message="Tambahkan akun dulu sebelum mengimpor rekening koran." />
      )}
    </Screen>
  );
}
