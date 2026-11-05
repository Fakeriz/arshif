import { CategoryIcon, CurrencyText, ListItem } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { formatMoney } from '@/lib/money';
import { amountIn } from '@/lib/transactions';

const SOURCE_LABEL: Record<Transaction['source'], string> = {
  manual: '',
  scan: 'Struk',
  voice: 'Voice',
  import: 'PDF',
  smartlog: 'Notifikasi bank',
};

export type TransactionRowProps = {
  tx: Transaction;
  accountName: string;
  mainCurrency: string;
  divider?: boolean;
  onPress?: () => void;
};

/** Satu baris transaksi. Mata uang asing diberi perkiraan nilai di mata uang utama. */
export function TransactionRow({ tx, accountName, mainCurrency, divider, onPress }: TransactionRowProps) {
  const source = SOURCE_LABEL[tx.source];
  const foreign = tx.currency !== mainCurrency;
  const transfer = tx.type === 'transfer';
  return (
    <ListItem
      leading={<CategoryIcon category={tx.categoryKey} />}
      title={tx.merchant}
      subtitle={[accountName, tx.time.replace(':', '.'), source].filter(Boolean).join(' · ')}
      trailing={
        <CurrencyText
          amount={tx.amount}
          currency={tx.currency}
          kind={tx.type === 'income' ? 'income' : transfer ? 'balance' : 'expense'}
          variant="bodyStrong"
          tone={transfer ? 'secondary' : undefined}
        />
      }
      trailingCaption={foreign ? `≈ ${formatMoney(amountIn(tx, mainCurrency), mainCurrency)}` : transfer ? 'Transfer' : undefined}
      divider={divider}
      onPress={onPress}
      accessibilityLabel={`${tx.merchant}, ${formatMoney(tx.amount, tx.currency)}, ${accountName}`}
    />
  );
}
