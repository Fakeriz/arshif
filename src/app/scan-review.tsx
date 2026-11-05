import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { EmptyState, useToast } from '@/components/ui';
import { discardPrivate } from '@/data/remote/upload';
import { clearHandoff, peekHandoff } from '@/features/capture/handoff';
import { ScanReview } from '@/features/capture/ScanReview';
import { useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';

export default function ScanReviewScreen() {
  const router = useRouter();
  const t = useT();
  const { show } = useToast();
  const { dispatch } = useStore();
  const { accounts } = useLedger();
  const [data] = useState(() => peekHandoff('scan'));
  const saved = useRef(false);

  // Keluar dari review tanpa menyimpan: foto struk tidak dipakai, jangan dibiarkan di storage.
  useEffect(() => {
    const path = data?.receiptPath;
    return () => {
      if (path && !saved.current) void discardPrivate('receipts', path);
    };
  }, [data]);

  return (
    <Screen glow={false}>
      <ScreenHeader title={t('capture.scanReview.title')} />
      {data ? (
        <ScanReview
          result={data.result}
          receiptPath={data.receiptPath}
          accounts={accounts}
          onRetake={() => {
            clearHandoff('scan');
            router.replace('/scan');
          }}
          onSave={(tx) => {
            // Kuota sudah dipotong server saat struk berhasil dibaca (angka di layar diambil ulang di layar Scan).
            saved.current = true;
            dispatch({ type: 'tx/add', tx });
            clearHandoff('scan');
            show({ tone: 'success', title: t('capture.scanReview.savedTitle'), message: t('capture.scanReview.savedMessage', { merchant: tx.merchant, amount: formatMoney(tx.amount, tx.currency) }) });
            router.replace('/transaksi');
          }}
        />
      ) : (
        <EmptyState title={t('capture.scanReview.missingTitle')} message={t('capture.scanReview.missingMessage')} actionLabel={t('capture.scan.title')} onAction={() => router.replace('/scan')} />
      )}
    </Screen>
  );
}
