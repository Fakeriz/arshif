import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CurrencySheet } from '@/components/shell/CurrencySheet';
import { AmountInput, Button, Chip, Input, Tabs } from '@/components/ui';
import type { Transaction, TxType } from '@/data/types';
import { DEMO_TODAY, addDays } from '@/lib/dates';
import { convert } from '@/lib/fx';
import { validateTx } from '@/lib/validate';
import type { AccountWithBalance } from '@/state/AppStore';
import { space } from '@/theme/tokens';

import { AccountPicker, CategoryPicker, categoriesFor } from './pickers';

const TYPES: { key: TxType; label: string }[] = [
  { key: 'expense', label: 'Pengeluaran' },
  { key: 'income', label: 'Pemasukan' },
  { key: 'transfer', label: 'Transfer' },
];

export type TransactionFormProps = {
  accounts: AccountWithBalance[];
  initial?: Transaction;
  onSubmit: (tx: Transaction) => void;
};

/** Form catat manual (FR-TRX-1): pengeluaran, pemasukan, dan transfer antar-akun. */
export function TransactionForm({ accounts, initial, onSubmit }: TransactionFormProps) {
  const first = accounts[0];
  const [type, setType] = useState<TxType>(initial?.type ?? 'expense');
  const [amount, setAmount] = useState<number | null>(initial?.amount ?? null);
  const [currency, setCurrency] = useState(initial?.currency ?? first?.currency ?? 'IDR');
  const [currencyTouched, setCurrencyTouched] = useState(!!initial);
  const [merchant, setMerchant] = useState(initial?.merchant ?? '');
  const [accountId, setAccountId] = useState<string | null>(initial?.accountId ?? first?.id ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(initial?.toAccountId ?? null);
  const [categoryKey, setCategoryKey] = useState<string | null>(initial?.categoryKey ?? null);
  const [date, setDate] = useState(initial?.date ?? DEMO_TODAY);
  const [note, setNote] = useState(initial?.note ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [sheet, setSheet] = useState(false);

  const errors = submitted ? validateTx({ type, amount, merchant, accountId, toAccountId, categoryKey, date }) : {};
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
      id: initial?.id ?? `n-${Date.now().toString(36)}`,
      type,
      merchant: type === 'transfer' ? merchant.trim() || `Transfer ke ${to?.name ?? ''}`.trim() : merchant.trim(),
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
      <Tabs items={TYPES} value={type} onChange={changeType} accessibilityLabel="Jenis transaksi" />
      <AmountInput value={amount} onChange={setAmount} currency={currency} onPressCurrency={() => setSheet(true)} error={errors.amount} autoFocus={!initial} />
      <AccountPicker label={type === 'transfer' ? 'Dari akun' : 'Akun'} accounts={accounts} value={accountId} onChange={pickAccount} error={errors.accountId} />
      {type === 'transfer' ? (
        <AccountPicker label="Ke akun" accounts={accounts.filter((a) => a.id !== accountId)} value={toAccountId} onChange={setToAccountId} error={errors.toAccountId} />
      ) : (
        <>
          <Input
            label={type === 'income' ? 'Sumber pemasukan' : 'Toko atau keterangan'}
            placeholder={type === 'income' ? 'Mis. Gaji, honor freelance' : 'Mis. Indomaret, makan siang'}
            value={merchant}
            onChangeText={setMerchant}
            error={errors.merchant}
          />
          <CategoryPicker type={type} value={categoryKey} onChange={setCategoryKey} error={errors.categoryKey} />
        </>
      )}
      <Input label="Tanggal" value={date} onChangeText={setDate} placeholder="TTTT-BB-HH" hint="Format TTTT-BB-HH, mis. 2026-11-05" error={errors.date} keyboardType="numbers-and-punctuation" />
      <View style={styles.dates}>
        <Chip label="Hari ini" selected={date === DEMO_TODAY} onPress={() => setDate(DEMO_TODAY)} />
        <Chip label="Kemarin" selected={date === addDays(DEMO_TODAY, -1)} onPress={() => setDate(addDays(DEMO_TODAY, -1))} />
      </View>
      <Input label="Catatan (opsional)" value={note} onChangeText={setNote} placeholder="Tambahkan catatan" />
      <Button label={initial ? 'Simpan perubahan' : 'Simpan transaksi'} fullWidth onPress={submit} />
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
