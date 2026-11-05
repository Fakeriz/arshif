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
  const { state, dispatch } = useStore();
  const { accounts } = useLedger();
  const [data] = useState(() => peekHandoff('scan'));
  const existing = data?.txId ? state.transactions.find((tx) => tx.id === data.txId) : undefined;
  const saved = useRef(false);

  // Keluar dari review tanpa menyimpan: foto struk baru tidak dipakai, jangan dibiarkan di storage.
  // Foto milik transaksi yang dibaca ulang tetap disimpan.
  useEffect(() => {
    const path = data?.txId ? undefined : data?.receiptPath;
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
          existing={existing}
          onRetake={() => {
            clearHandoff('scan');
            if (existing) router.back();
            else router.replace('/scan');
          }}
          onSave={(tx) => {
            // Kuota sudah dipotong server saat struk berhasil dibaca (angka di layar diambil ulang di layar Scan).
            saved.current = true;
            clearHandoff('scan');
            if (existing) {
              dispatch({ type: 'tx/update', tx });
              show({ tone: 'success', title: t('tx.form.updated') });
              router.back();
              return;
            }
            dispatch({ type: 'tx/add', tx });
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
