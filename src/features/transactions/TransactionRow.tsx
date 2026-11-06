import { useT, type MsgKey } from '@/i18n';
import { CategoryIcon, CurrencyText, ListItem } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { formatMoney } from '@/lib/money';
import { amountIn } from '@/lib/transactions';

const SOURCE_LABEL: Record<Transaction['source'], MsgKey | null> = {
  manual: null,
  scan: 'tx.rowSource.scan',
  voice: 'tx.rowSource.voice',
  import: 'tx.rowSource.import',
  smartlog: 'tx.rowSource.smartlog',
  invoice: 'tx.rowSource.invoice',
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
  const t = useT();
  const sourceKey = SOURCE_LABEL[tx.source];
  const source = sourceKey ? t(sourceKey) : '';
  const foreign = tx.currency !== mainCurrency;
  const transfer = tx.type === 'transfer';
  return (
    <ListItem
      leading={<CategoryIcon category={tx.categoryKey} />}
      title={tx.merchant}
      // Jam dan sumber pendek dan tetap; nama akun yang panjangnya bervariasi diletakkan terakhir agar dialah yang terpotong.
      subtitle={[tx.time.replace(':', '.'), source, accountName].filter(Boolean).join(' · ')}
      trailing={
        <CurrencyText
          amount={tx.amount}
          currency={tx.currency}
          kind={tx.type === 'income' ? 'income' : transfer ? 'balance' : 'expense'}
          variant="bodyStrong"
          tone={transfer ? 'secondary' : undefined}
        />
      }
      trailingCaption={
        tx.reimburseStatus
          ? t(tx.reimburseStatus === 'pending' ? 'tx.reimb.rowPending' : 'tx.reimb.rowDone')
          : foreign
            ? `≈ ${formatMoney(amountIn(tx, mainCurrency), mainCurrency)}`
            : transfer
              ? t('common.transfer')
              : undefined
      }
      divider={divider}
      onPress={onPress}
      accessibilityLabel={`${tx.merchant}, ${formatMoney(tx.amount, tx.currency)}, ${accountName}`}
    />
  );
}
