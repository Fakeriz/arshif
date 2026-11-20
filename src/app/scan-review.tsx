import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { EmptyState, useToast } from '@/components/ui';
import { startScan } from '@/features/capture/scanLaunch';
import { discardPrivate } from '@/data/remote/upload';
import { clearHandoff, peekHandoff, putHandoff } from '@/features/capture/handoff';
import { ScanReview } from '@/features/capture/ScanReview';
import { useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';
import { goBack } from '@/components/shell/goBack';

export default function ScanReviewScreen() {
  const router = useRouter();
  // Simpan menunggu 450 ms (centang "Tersimpan"); pengguna yang sudah kembali sendiri tidak dipindah lagi.
  const navigation = useNavigation();
  const t = useT();
  const { show } = useToast();
  const { state, dispatch } = useStore();
  const { accounts } = useLedger();
  const [data] = useState(() => peekHandoff('scan'));
  const existing = data?.txId ? state.transactions.find((tx) => tx.id === data.txId) : undefined;
  const saved = useRef(false);
  const [queueLeft] = useState(() => (data?.txId ? 0 : (peekHandoff('scanQueue')?.length ?? 0)));
  const retaking = useRef(false);

  // Keluar dari review tanpa menyimpan: foto struk baru (dan sisa antrean Beberapa struk) tidak dipakai, jangan dibiarkan
  // di storage. Foto milik transaksi yang dibaca ulang tetap disimpan. Foto ulang: antrean tetap menunggu.
  useEffect(() => {
    const path = data?.txId ? undefined : data?.receiptPath;
    return () => {
      if (saved.current) return;
      if (path) void discardPrivate('receipts', path);
      if (retaking.current) return;
      for (const q of peekHandoff('scanQueue') ?? []) void discardPrivate('receipts', q.receiptPath);
      clearHandoff('scanQueue');
    };
  }, [data]);

  return (
    <Screen>
      <ScreenHeader title={queueLeft ? `${t('capture.scanReview.title')} · ${t('capture.source.queueLeft', { count: queueLeft })}` : t('capture.scanReview.title')} />
      {data ? (
        <ScanReview
          result={data.result}
          receiptPath={data.receiptPath}
          accounts={accounts}
          existing={existing}
          onRetake={() => {
            if (existing) {
              clearHandoff('scan');
              return goBack(router);
            }
            // Kamera dibuka di sini; layar Scan baru menggantikan review setelah foto diambil. Batal = tetap di review.
            startScan('camera', (h) => {
              clearHandoff('scan');
              retaking.current = true;
              router.replace(h);
            });
          }}
          onSave={(tx) => {
            // Ketukan ganda sebelum navigasi selesai: tiap ketukan membuat id baru, jadi yang kedua diabaikan.
            if (saved.current) return;
            // Kuota sudah dipotong server saat struk berhasil dibaca (angka di layar diambil ulang di layar Scan).
            saved.current = true;
            clearHandoff('scan');
            if (existing) {
              dispatch({ type: 'tx/update', tx });
              show({ tone: 'success', title: t('tx.form.updated') });
              if (navigation.isFocused()) goBack(router);
              return;
            }
            dispatch({ type: 'tx/add', tx });
            show({ tone: 'success', title: t('capture.scanReview.savedTitle'), message: t('capture.scanReview.savedMessage', { merchant: tx.merchant, amount: formatMoney(tx.amount, tx.currency) }) });
            // Beberapa struk: lanjut ke struk berikutnya (layar baru lewat replace, jadi state review mulai dari awal).
            const [next, ...rest] = peekHandoff('scanQueue') ?? [];
            if (next && navigation.isFocused()) {
              putHandoff('scan', next);
              putHandoff('scanQueue', rest);
              router.replace({ pathname: '/scan-review', params: { left: rest.length } });
              return;
            }
            // Sudah keluar sendiri sebelum lanjut: sisa antrean tidak dipakai.
            for (const q of next ? [next, ...rest] : []) void discardPrivate('receipts', q.receiptPath);
            clearHandoff('scanQueue');
            if (navigation.isFocused()) router.replace('/transaksi');
          }}
        />
      ) : (
        <EmptyState title={t('capture.scanReview.missingTitle')} message={t('capture.scanReview.missingMessage')} actionLabel={t('capture.scan.title')} onAction={() => startScan('camera', (h) => router.replace(h))} />
      )}
    </Screen>
  );
}
