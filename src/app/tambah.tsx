import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { EmptyState, useToast } from '@/components/ui';
import { TransactionForm } from '@/features/transactions/TransactionForm';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';

export default function TambahScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { show } = useToast();
  const { state, dispatch } = useStore();
  const { accounts } = useLedger();
  const initial = id ? state.transactions.find((t) => t.id === id) : undefined;

  return (
    <Screen glow={false}>
      <ScreenHeader title={initial ? 'Ubah transaksi' : 'Catat transaksi'} />
      {id && !initial ? (
        <EmptyState title="Transaksi tidak ditemukan" actionLabel="Kembali" onAction={() => router.back()} />
      ) : (
        <TransactionForm
          accounts={accounts}
          initial={initial}
          onSubmit={(tx) => {
            dispatch({ type: initial ? 'tx/update' : 'tx/add', tx });
            show({ tone: 'success', title: initial ? 'Perubahan disimpan' : 'Transaksi tersimpan', message: `${tx.merchant} · ${formatMoney(tx.amount, tx.currency)}` });
            router.back();
          }}
        />
      )}
    </Screen>
  );
}
