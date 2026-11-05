import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT, type MsgKey } from '@/i18n';
import { CurrencySheet } from '@/components/shell/CurrencySheet';
import { AmountInput, Button, Chip, Input, Tabs } from '@/components/ui';
import type { Transaction, TxType } from '@/data/types';
import { addDays, todayYmd } from '@/lib/dates';
import { convert } from '@/lib/fx';
import { validateTx } from '@/lib/validate';
import { newId } from '@/lib/uuid';
import { useActiveAccountId, type AccountWithBalance } from '@/state/AppStore';
import { space } from '@/theme/tokens';

import { AccountPicker, CategoryPicker, categoriesFor } from './pickers';

const TYPES: { key: TxType; label: MsgKey }[] = [
  { key: 'expense', label: 'common.expense' },
  { key: 'income', label: 'common.income' },
  { key: 'transfer', label: 'common.transfer' },
];

export type TransactionFormProps = {
  accounts: AccountWithBalance[];
  initial?: Transaction;
  onSubmit: (tx: Transaction) => void;
};

/** Form catat manual (FR-TRX-1): pengeluaran, pemasukan, dan transfer antar-akun. */
export function TransactionForm({ accounts, initial, onSubmit }: TransactionFormProps) {
  const t = useT();
  const activeId = useActiveAccountId();
  const first = accounts.find((a) => a.id === activeId) ?? accounts[0];
  const [type, setType] = useState<TxType>(initial?.type ?? 'expense');
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [currency, setCurrency] = useState(initial?.currency ?? first?.currency ?? 'IDR');
  const [currencyTouched, setCurrencyTouched] = useState(!!initial);
  const [merchant, setMerchant] = useState(initial?.merchant ?? '');
  const [accountId, setAccountId] = useState<string | null>(initial?.accountId ?? first?.id ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(initial?.toAccountId ?? null);
  const [categoryKey, setCategoryKey] = useState<string | null>(initial?.categoryKey ?? null);
  const today = todayYmd();
  const [date, setDate] = useState(initial?.date ?? today);
  const [note, setNote] = useState(initial?.note ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [sheet, setSheet] = useState(false);

  const errorKeys = submitted ? validateTx({ type, amount, merchant, accountId, toAccountId, categoryKey, date }) : {};
  const errors = Object.fromEntries(Object.entries(errorKeys).map(([k, v]) => [k, t(v)])) as Partial<Record<keyof typeof errorKeys, string>>;
  const account = accounts.find((a) => a.id === accountId);

  const pickAccount = (id: string) => {
    setAccountId(id);
    const acc = accounts.find((a) => a.id === id);
    if (acc && !currencyTouched) setCurrency(acc.currency);
  };

  const changeType = (next: TxType) => {
    setType(next);
    if (categoryKey && !categoriesFor(next).some((c) => c.key === categoryKey)) setCategoryKey(null);
  };

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(validateTx({ type, amount, merchant, accountId, toAccountId, categoryKey, date })).length > 0 || !amount || !account) return;
    const to = accounts.find((a) => a.id === toAccountId);
    const accountAmount = account.currency !== currency ? convert(amount, currency, account.currency) : undefined;
    const sourceAmount = accountAmount ?? amount;
    onSubmit({
      id: initial?.id ?? newId(),
      type,
      merchant: type === 'transfer' ? merchant.trim() || t('tx.form.transferTo', { account: to?.name ?? '' }).trim() : merchant.trim(),
      categoryKey: type === 'transfer' ? 'savings' : (categoryKey as string),
      accountId: account.id,
      toAccountId: type === 'transfer' ? (toAccountId ?? undefined) : undefined,
      toAmount: type === 'transfer' && to && to.currency !== account.currency ? convert(sourceAmount, account.currency, to.currency) : undefined,
      date,
      time: initial?.time ?? '09:30',
      amount,
      currency,
      accountAmount,
      note: note.trim() || undefined,
      source: initial?.source ?? 'manual',
      items: initial?.items,
    });
  };

  return (
    <View style={styles.form}>
      <Tabs items={TYPES.map((ty) => ({ key: ty.key, label: t(ty.label) }))} value={type} onChange={changeType} accessibilityLabel={t('tx.form.type')} />
      <AmountInput value={amount} onChange={setAmount} currency={currency} onPressCurrency={() => setSheet(true)} error={errors.amount} autoFocus={!initial} />
      <AccountPicker label={type === 'transfer' ? t('tx.detail.fromAccount') : t('tx.detail.account')} accounts={accounts} value={accountId} onChange={pickAccount} error={errors.accountId} />
      {type === 'transfer' ? (
        <AccountPicker label={t('tx.detail.toAccount')} accounts={accounts.filter((a) => a.id !== accountId)} value={toAccountId} onChange={setToAccountId} error={errors.toAccountId} />
      ) : (
        <>
          <Input
            label={type === 'income' ? t('tx.form.incomeSource') : t('tx.form.merchant')}
            placeholder={type === 'income' ? t('tx.form.incomePlaceholder') : t('tx.form.merchantPlaceholder')}
            value={merchant}
            onChangeText={setMerchant}
            error={errors.merchant}
          />
          <CategoryPicker type={type} value={categoryKey} onChange={setCategoryKey} error={errors.categoryKey} />
        </>
      )}
      <Input label={t('tx.form.date')} value={date} onChangeText={setDate} placeholder={t('domain.date.datePlaceholder')} hint={t('tx.form.dateHint')} error={errors.date} keyboardType="numbers-and-punctuation" />
      <View style={styles.dates}>
        <Chip label={t('domain.date.today')} selected={date === today} onPress={() => setDate(today)} />
        <Chip label={t('domain.date.yesterday')} selected={date === addDays(today, -1)} onPress={() => setDate(addDays(today, -1))} />
      </View>
      <Input label={t('tx.form.note')} value={note} onChangeText={setNote} placeholder={t('tx.form.notePlaceholder')} />
      <Button label={initial ? t('tx.form.saveEdit') : t('tx.form.saveNew')} fullWidth onPress={submit} />
      <CurrencySheet
        visible={sheet}
        value={currency}
        onClose={() => setSheet(false)}
        onSelect={(c) => {
          setCurrency(c);
          setCurrencyTouched(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.xl },
  dates: { flexDirection: 'row', gap: space.sm, marginTop: -space.md },
});
