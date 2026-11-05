import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CurrencySheet } from '@/components/shell/CurrencySheet';
import { AmountField, AppText, Chip, Input, useToast } from '@/components/ui';
import type { Bill, Debt, DebtKind, Goal, Subscription, SubscriptionCycle } from '@/data/planning';
import { localYmd } from '@/features/capture/clock';
import { AccountPicker, CategoryPicker } from '@/features/transactions/pickers';
import { useT } from '@/i18n';
import type { Frequency } from '@/lib/planning/schedule';
import { SUBSCRIPTION_PRESETS } from '@/lib/planning/subscriptions';
import { useAccounts, useStore } from '@/state/AppStore';
import { usePlanning } from '@/state/planning';
import { space } from '@/theme/tokens';

import { ChoiceRow, DateField, FormSheet, isYmd, useSaveError } from './kit';

/** Mata uang: chip yang membuka daftar mata uang. */
function CurrencyField({ value, onChange, locked }: { value: string; onChange: (c: string) => void; locked?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <AppText variant="caption" tone="secondary">
        {t('plan.common.currency')}
      </AppText>
      <View style={styles.row}>
        <Chip label={value} selected onPress={locked ? undefined : () => setOpen(true)} disabled={locked} />
      </View>
      <CurrencySheet visible={open} value={value} onSelect={(c) => { onChange(c); setOpen(false); }} onClose={() => setOpen(false)} />
    </View>
  );
}

/** "24,5" / "24.50" -> 2450 basis poin, tanpa float. null = tidak valid. */
export function parsePercentBp(text: string): number | null {
  const s = text.trim().replace(',', '.');
  if (s === '') return 0;
  const m = /^(\d{1,4})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const bp = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0);
  return bp <= 100000 ? bp : null;
}
export const formatBp = (bp: number): string => (bp % 100 === 0 ? String(bp / 100) : (bp / 100).toFixed(2).replace(/0$/, ''));

const anchorOf = (date: string) => Number(date.slice(8, 10));

// ------------------------------------------------------------------ goal
export function GoalForm({ visible, onClose, goal }: { visible: boolean; onClose: () => void; goal?: Goal }) {
  const t = useT();
  const { show } = useToast();
  const { state } = useStore();
  const accounts = useAccounts();
  const { addGoal, editGoal } = usePlanning();
  const saveError = useSaveError();
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState<number | null>(goal?.target ?? null);
  const [currency, setCurrency] = useState(goal?.currency ?? state.mainCurrency);
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [accountId, setAccountId] = useState<string | null>(goal?.accountId ?? null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const deadlineBad = deadline !== '' && !isYmd(deadline);

  const submit = async () => {
    setTried(true);
    if (!name.trim() || !target || target <= 0 || deadlineBad || saving) return;
    setSaving(true);
    const input = { name: name.trim(), target, currency, deadline: deadline || undefined, accountId: accountId ?? undefined };
    try {
      if (goal) await editGoal(goal.id, input);
      else await addGoal(input);
      show({ tone: 'success', title: t('plan.common.saved') });
      onClose();
    } catch (e) {
      saveError(e, t('plan.goals.limitReason'), onClose);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet visible={visible} onClose={onClose} title={goal ? t('plan.goals.editTitle') : t('plan.goals.create')} submitLabel={t('plan.common.save')} saving={saving} onSubmit={() => void submit()}>
      <Input label={t('plan.common.name')} value={name} onChangeText={setName} maxLength={80} error={tried && !name.trim() ? t('plan.common.nameError') : undefined} />
      <AmountField label={`${t('plan.goals.target')} (${currency})`} value={target} onChange={setTarget} currency={currency} error={tried && (!target || target <= 0) ? t('plan.common.amountError') : undefined} />
      <CurrencyField value={currency} onChange={setCurrency} locked={!!goal} />
      <DateField label={t('plan.goals.deadline')} value={deadline} onChange={setDeadline} error={tried && deadlineBad} optional />
      {accounts.length > 0 && <AccountPicker label={t('plan.goals.defaultAccount')} accounts={accounts} value={accountId} onChange={(id) => setAccountId((cur) => (cur === id ? null : id))} />}
    </FormSheet>
  );
}

// ------------------------------------------------------------------ bill
const FREQS: Frequency[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

export function BillForm({ visible, onClose, bill }: { visible: boolean; onClose: () => void; bill?: Bill }) {
  const t = useT();
  const { show } = useToast();
  const { state } = useStore();
  const accounts = useAccounts();
  const { addBill, editBill } = usePlanning();
  const saveError = useSaveError();
  const [name, setName] = useState(bill?.name ?? '');
  const [amount, setAmount] = useState<number | null>(bill?.amount ?? null);
  const [currency, setCurrency] = useState(bill?.currency ?? state.mainCurrency);
  const [frequency, setFrequency] = useState<Frequency>(bill?.frequency ?? 'monthly');
  const [dueDate, setDueDate] = useState(bill?.dueDate ?? localYmd());
  const [accountId, setAccountId] = useState<string | null>(bill?.accountId ?? null);
  const [category, setCategory] = useState<string | null>(bill?.categoryKey ?? 'bills');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setTried(true);
    if (!name.trim() || !amount || amount <= 0 || !isYmd(dueDate) || !category || saving) return;
    setSaving(true);
    // Hari jangkar ikut tanggal yang dipilih; jatuh tempo tanggal 31 tetap kembali ke 31 setelah bulan pendek.
    const input = { name: name.trim(), amount, currency, frequency, dueDate, anchorDay: anchorOf(dueDate), accountId: accountId ?? undefined, categoryKey: category };
    try {
      if (bill) await editBill(bill.id, input);
      else await addBill(input);
      show({ tone: 'success', title: t('plan.common.saved') });
      onClose();
    } catch (e) {
      saveError(e, t('plan.bills.limitReason'), onClose);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet visible={visible} onClose={onClose} title={bill ? t('plan.bills.editTitle') : t('plan.bills.create')} submitLabel={t('plan.common.save')} saving={saving} onSubmit={() => void submit()}>
      <Input label={t('plan.common.name')} value={name} onChangeText={setName} maxLength={80} error={tried && !name.trim() ? t('plan.common.nameError') : undefined} />
      <AmountField label={`${t('plan.common.amount')} (${currency})`} value={amount} onChange={setAmount} currency={currency} error={tried && (!amount || amount <= 0) ? t('plan.common.amountError') : undefined} />
      <CurrencyField value={currency} onChange={setCurrency} />
      <ChoiceRow label={t('plan.bills.frequency')} value={frequency} onChange={setFrequency} options={FREQS.map((f) => ({ key: f, label: t(`plan.bills.freq.${f}`) }))} />
      <DateField label={t('plan.bills.dueDate')} value={dueDate} onChange={setDueDate} error={tried && !isYmd(dueDate)} />
      <CategoryPicker type="expense" scroll value={category} onChange={setCategory} />
      {accounts.length > 0 && <AccountPicker label={t('plan.common.accountOptional')} accounts={accounts} value={accountId} onChange={(id) => setAccountId((cur) => (cur === id ? null : id))} />}
    </FormSheet>
  );
}

// ------------------------------------------------------------------ debt
export function DebtForm({ visible, onClose, debt, kind: initialKind }: { visible: boolean; onClose: () => void; debt?: Debt; kind: DebtKind }) {
  const t = useT();
  const { show } = useToast();
  const { state } = useStore();
  const { addDebt, editDebt } = usePlanning();
  const saveError = useSaveError();
  const [kind, setKind] = useState<DebtKind>(debt?.kind ?? initialKind);
  const [counterparty, setCounterparty] = useState(debt?.counterparty ?? '');
  const [contact, setContact] = useState(debt?.contact ?? '');
  const [principal, setPrincipal] = useState<number | null>(debt?.principal ?? null);
  const [currency, setCurrency] = useState(debt?.currency ?? state.mainCurrency);
  const [apr, setApr] = useState(debt ? formatBp(debt.aprBp) : '');
  const [minPayment, setMinPayment] = useState<number | null>(debt?.minPayment ?? null);
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '');
  const [note, setNote] = useState(debt?.note ?? '');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const aprBp = parsePercentBp(apr);
  const dueBad = dueDate !== '' && !isYmd(dueDate);

  const submit = async () => {
    setTried(true);
    if (!counterparty.trim() || (!debt && (!principal || principal <= 0)) || aprBp === null || dueBad || saving) return;
    setSaving(true);
    const common = { counterparty: counterparty.trim(), contact: contact.trim() || undefined, aprBp, minPayment: minPayment ?? 0, dueDate: dueDate || undefined, note: note.trim() || undefined };
    try {
      if (debt) await editDebt(debt.id, common);
      else await addDebt({ ...common, kind, principal: principal!, currency });
      show({ tone: 'success', title: t('plan.common.saved') });
      onClose();
    } catch (e) {
      saveError(e, t('plan.debts.limitReason'), onClose);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title={debt ? t('plan.debts.editTitle') : kind === 'debt' ? t('plan.debts.createDebt') : t('plan.debts.createReceivable')}
      submitLabel={t('plan.common.save')}
      saving={saving}
      onSubmit={() => void submit()}
    >
      {!debt && <ChoiceRow label={t('plan.debts.kind')} value={kind} onChange={setKind} options={(['debt', 'receivable'] as const).map((k) => ({ key: k, label: t(`plan.debts.tabs.${k}`) }))} />}
      <Input
        label={kind === 'debt' ? t('plan.debts.counterpartyDebt') : t('plan.debts.counterpartyReceivable')}
        value={counterparty}
        onChangeText={setCounterparty}
        maxLength={80}
        error={tried && !counterparty.trim() ? t('plan.common.nameError') : undefined}
      />
      <Input label={t('plan.debts.contact')} value={contact} onChangeText={setContact} maxLength={80} autoCapitalize="none" />
      {!debt && (
        <>
          <AmountField label={`${t('plan.debts.principal')} (${currency})`} value={principal} onChange={setPrincipal} currency={currency} error={tried && (!principal || principal <= 0) ? t('plan.common.amountError') : undefined} />
          <CurrencyField value={currency} onChange={setCurrency} />
        </>
      )}
      <Input label={t('plan.debts.apr')} value={apr} onChangeText={setApr} keyboardType="decimal-pad" placeholder="0" error={tried && aprBp === null ? t('plan.debts.aprError') : undefined} />
      <AmountField label={`${t('plan.debts.minPayment')} (${debt?.currency ?? currency})`} value={minPayment} onChange={setMinPayment} currency={debt?.currency ?? currency} />
      <DateField label={t('plan.debts.dueDate')} value={dueDate} onChange={setDueDate} error={tried && dueBad} optional />
      <Input label={t('plan.debts.note')} value={note} onChangeText={setNote} maxLength={200} />
    </FormSheet>
  );
}

// ------------------------------------------------------------------ subscription
const CYCLES: SubscriptionCycle[] = ['weekly', 'monthly', 'yearly'];

export function SubscriptionForm({ visible, onClose, sub }: { visible: boolean; onClose: () => void; sub?: Subscription }) {
  const t = useT();
  const { show } = useToast();
  const { state } = useStore();
  const accounts = useAccounts();
  const { addSub, editSub } = usePlanning();
  const saveError = useSaveError();
  const [preset, setPreset] = useState<string | undefined>(sub?.preset);
  const [name, setName] = useState(sub?.name ?? '');
  const [amount, setAmount] = useState<number | null>(sub?.amount ?? null);
  const [currency, setCurrency] = useState(sub?.currency ?? state.mainCurrency);
  const [cycle, setCycle] = useState<SubscriptionCycle>(sub?.cycle ?? 'monthly');
  const [nextRenewal, setNextRenewal] = useState(sub?.nextRenewal ?? localYmd());
  const [accountId, setAccountId] = useState<string | null>(sub?.accountId ?? null);
  const [category, setCategory] = useState(sub?.categoryKey ?? 'entertainment');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickPreset = (key: string | undefined) => {
    setPreset(key);
    const p = SUBSCRIPTION_PRESETS.find((x) => x.key === key);
    if (p) {
      setName(p.name);
      setCategory(p.categoryKey);
    } else setName('');
  };

  const submit = async () => {
    setTried(true);
    if (!name.trim() || !amount || amount <= 0 || !isYmd(nextRenewal) || saving) return;
    setSaving(true);
    const input = { name: name.trim(), preset, amount, currency, cycle, nextRenewal, anchorDay: anchorOf(nextRenewal), accountId: accountId ?? undefined, categoryKey: category };
    try {
      if (sub) await editSub(sub.id, input);
      else await addSub(input);
      show({ tone: 'success', title: t('plan.common.saved') });
      onClose();
    } catch (e) {
      saveError(e, t('plan.subs.limitReason'), onClose);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet visible={visible} onClose={onClose} title={sub ? t('plan.subs.editTitle') : t('plan.subs.create')} submitLabel={t('plan.common.save')} saving={saving} onSubmit={() => void submit()}>
      {!sub && (
        <View style={styles.field}>
          <AppText variant="caption" tone="secondary">
            {t('plan.subs.popular')}
          </AppText>
          <View style={styles.wrap}>
            {SUBSCRIPTION_PRESETS.map((p) => (
              <Chip key={p.key} label={p.name} selected={preset === p.key} onPress={() => pickPreset(p.key)} />
            ))}
            <Chip label={t('plan.subs.custom')} selected={!preset} onPress={() => pickPreset(undefined)} />
          </View>
        </View>
      )}
      <Input label={t('plan.common.name')} value={name} onChangeText={setName} maxLength={80} error={tried && !name.trim() ? t('plan.common.nameError') : undefined} />
      <AmountField label={`${t('plan.common.amount')} (${currency})`} value={amount} onChange={setAmount} currency={currency} error={tried && (!amount || amount <= 0) ? t('plan.common.amountError') : undefined} />
      <CurrencyField value={currency} onChange={setCurrency} />
      <ChoiceRow label={t('plan.subs.cycle')} value={cycle} onChange={setCycle} options={CYCLES.map((c) => ({ key: c, label: t(`plan.subs.cycles.${c}`) }))} />
      <DateField label={t('plan.subs.nextRenewal')} value={nextRenewal} onChange={setNextRenewal} error={tried && !isYmd(nextRenewal)} />
      {accounts.length > 0 && <AccountPicker label={t('plan.common.accountOptional')} accounts={accounts} value={accountId} onChange={(id) => setAccountId((cur) => (cur === id ? null : id))} />}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  row: { flexDirection: 'row' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
