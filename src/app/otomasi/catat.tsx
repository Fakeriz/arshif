import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { EmptyState, useToast } from '@/components/ui';
import { TransactionForm } from '@/features/transactions/TransactionForm';
import { useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { useLedger } from '@/state/derived';
import { draftFromItem, useSmartLog } from '@/state/smartlog';

/** "Ubah dulu" dari To Review: isian notifikasi bisa dikoreksi (kartu, jenis, kategori) sebelum dicatat. */
export default function ReviewEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const t = useT();
  const { show } = useToast();
  const { accounts } = useLedger();
  const { review, confirm } = useSmartLog();
  const item = review.find((r) => r.id === id);
  const [saving, setSaving] = useState(false);

  return (
    <Screen glow={false}>
      <ScreenHeader title={t('slog.review.editTitle')} />
      {!item ? (
        <EmptyState title={t('slog.review.notFound')} actionLabel={t('common.back')} onAction={() => router.back()} />
      ) : (
        <TransactionForm
          accounts={accounts}
          initial={draftFromItem(item)}
          onSubmit={(tx) => {
            if (saving) return;
            setSaving(true);
            confirm(item, tx)
              .then(() => {
                show({ tone: 'success', title: t('slog.review.confirmed'), message: `${tx.merchant} · ${formatMoney(tx.amount, tx.currency)}` });
                router.back();
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
