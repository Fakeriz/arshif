import { useLocalSearchParams, useRouter } from 'expo-router';

import { useT } from '@/i18n';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { EmptyState, useToast } from '@/components/ui';
import { ImportReview } from '@/features/capture/ImportReview';
import { useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';

export default function ImportReviewScreen() {
  const { akun } = useLocalSearchParams<{ akun?: string }>();
  const router = useRouter();
  const t = useT();
  const { show } = useToast();
  const { dispatch } = useStore();
  const { accounts, transactions } = useLedger();
  const account = accounts.find((a) => a.id === akun) ?? accounts[0];

  return (
    <Screen glow={false}>
      <ScreenHeader title={t('capture.importReview.title')} />
      {account ? (
        <ImportReview
          accountId={account.id}
          accountName={account.name}
          currency={account.currency}
          existing={transactions}
          onImport={(txs) => {
            dispatch({ type: 'tx/addMany', txs, consumes: 'importPdf' });
            show({ tone: 'success', title: t('capture.importReview.importedTitle', { count: txs.length }), message: t('capture.importReview.importedMessage', { account: account.name }) });
            router.replace('/transaksi');
          }}
        />
      ) : (
        <EmptyState title={t('capture.importReview.noAccountTitle')} message={t('capture.importReview.noAccountMessage')} />
      )}
    </Screen>
  );
}
