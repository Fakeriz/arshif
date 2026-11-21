import { useLocalSearchParams, useRouter } from 'expo-router';

import { goBack } from '@/components/shell/goBack';
import { Screen } from '@/components/shell/Screen';
import { TransactionDetail } from '@/features/transactions/TransactionDetail';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <Screen>
      <TransactionDetail id={id} onDeleted={() => goBack(router)} />
    </Screen>
  );
}
