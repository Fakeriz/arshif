import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { EmptyState, useToast } from '@/components/ui';
import { clearHandoff, peekHandoff } from '@/features/capture/handoff';
import { ImportReview } from '@/features/capture/ImportReview';
import { useT } from '@/i18n';
import { useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';

export default function ImportReviewScreen() {
  const router = useRouter();
  const t = useT();
  const { show } = useToast();
  const { dispatch } = useStore();
  const { accounts, transactions } = useLedger();
  const [data] = useState(() => peekHandoff('import'));
  const account = data ? accounts.find((a) => a.id === data.accountId) : undefined;

  let body;
  if (!data) {
    body = <EmptyState title={t('capture.importReview.missingTitle')} message={t('capture.importReview.missingMessage')} actionLabel={t('capture.import.pickFile')} onAction={() => router.replace('/import')} />;
  } else if (!account) {
    body = <EmptyState title={t('capture.importReview.noAccountTitle')} message={t('capture.importReview.noAccountMessage')} />;
  } else {
    body = (
      <ImportReview
        result={data.result}
        accountId={account.id}
        accountName={account.name}
        existing={transactions}
        onImport={(txs) => {
          // Kuota import sudah dipotong server saat PDF berhasil dibaca; ini hanya menyamakan angka di layar.
          dispatch({ type: 'tx/addMany', txs });
          clearHandoff('import');
          show({ tone: 'success', title: t('capture.importReview.importedTitle', { count: txs.length }), message: t('capture.importReview.importedMessage', { account: account.name }) });
          router.replace('/transaksi');
        }}
      />
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('capture.importReview.title')} />
      {body}
    </Screen>
  );
}
