import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { EmptyState, Skeleton, useToast } from '@/components/ui';
import { TransactionForm } from '@/features/transactions/TransactionForm';
import { useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { useLedger } from '@/state/derived';
import { draftFromItem, useSmartLog } from '@/state/smartlog';
import { goBack } from '@/components/shell/goBack';
import { radius } from '@/theme/tokens';

/** "Ubah dulu" dari To Review: isian notifikasi bisa dikoreksi (kartu, jenis, kategori) sebelum dicatat. */
export default function ReviewEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const t = useT();
  const { show } = useToast();
  const { accounts } = useLedger();
  const { review, rules, confirm, status, reload } = useSmartLog();
  const item = review.find((r) => r.id === id);
  const [saving, setSaving] = useState(false);
  const loading = !item && (status === 'idle' || status === 'loading');
  const failed = !item && status === 'error';

  return (
    <Screen>
      <ScreenHeader title={t('slog.review.editTitle')} />
      {loading ? (
        <Skeleton height={240} radius={radius.lg} />
      ) : failed ? (
        <EmptyState kind="error" title={t('slog.review.loadErrorTitle')} message={t('slog.review.loadErrorMessage')} actionLabel={t('common.retry')} onAction={() => void reload()} />
      ) : !item ? (
        <EmptyState title={t('slog.review.notFound')} actionLabel={t('common.back')} onAction={() => goBack(router)} />
      ) : (
        <TransactionForm
          accounts={accounts}
          initial={draftFromItem(item, rules)}
          onSubmit={(tx) => {
            if (saving) return;
            setSaving(true);
            confirm(item, tx)
              .then(() => {
                show({ tone: 'success', title: t('slog.review.confirmed'), message: `${tx.merchant} · ${formatMoney(tx.amount, tx.currency)}` });
                goBack(router);
              })
              .catch(() => {
                show({ tone: 'error', title: t('slog.review.failed') });
                setSaving(false);
              });
          }}
        />
      )}
    </Screen>
  );
}
