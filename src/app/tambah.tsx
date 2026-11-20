import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';

import { useT } from '@/i18n';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { EmptyState, useToast } from '@/components/ui';
import { TransactionForm } from '@/features/transactions/TransactionForm';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';
import { goBack } from '@/components/shell/goBack';

export default function TambahScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  // Simpan menunggu 450 ms (centang "Tersimpan"); pengguna yang sudah kembali sendiri tidak dipindah lagi.
  const navigation = useNavigation();
  const t = useT();
  const { show } = useToast();
  const { state, dispatch } = useStore();
  const { accounts } = useLedger();
  const initial = id ? state.transactions.find((t) => t.id === id) : undefined;

  return (
    <Screen>
      <ScreenHeader title={initial ? t('tx.form.titleEdit') : t('tx.form.titleNew')} />
      {id && !initial ? (
        <EmptyState title={t('tx.form.notFound')} actionLabel={t('common.back')} onAction={() => goBack(router)} />
      ) : (
        <TransactionForm
          accounts={accounts}
          initial={initial}
          onSubmit={(tx) => {
            dispatch({ type: initial ? 'tx/update' : 'tx/add', tx });
            show({ tone: 'success', title: initial ? t('tx.form.updated') : t('tx.form.saved'), message: `${tx.merchant} · ${formatMoney(tx.amount, tx.currency)}` });
            if (navigation.isFocused()) goBack(router);
          }}
        />
      )}
    </Screen>
  );
}
