import { Plus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { usePaywall } from '@/components/shell/Paywall';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AmountField, AppText, BottomSheet, Button, Chip, DateField, EmptyState, Input, ProBadge, Skeleton, useToast } from '@/components/ui';
import { QuotaError } from '@/data/remote/planning';
import { localYmd } from '@/features/capture/clock';
import { AccountPicker } from '@/features/transactions/pickers';
import { useT } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { newId } from '@/lib/uuid';
import { useActiveAccountId } from '@/state/AppStore';
import { useLedger } from '@/state/derived';
import { usePlanning, type PayInput } from '@/state/planning';
import { radius, space } from '@/theme/tokens';

export { DateField };

export const YMD_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const isYmd = (s: string): boolean => YMD_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Layar Planning: header + status muat bersama (memuat, gagal, siap). */
export function PlanScreen({ title, right, children, tabs }: { title: string; right?: ReactNode; children: ReactNode; tabs?: boolean }) {
  const t = useT();
  const { status, reload } = usePlanning();
  return (
    <Screen tabs={tabs} onRefresh={status === 'ready' ? () => void reload() : undefined}>
      <ScreenHeader title={title} right={status === 'ready' ? right : undefined} />
      {status === 'error' ? (
        <EmptyState kind="error" title={t('plan.common.loadErrorTitle')} message={t('plan.common.loadErrorMessage')} actionLabel={t('common.retry')} onAction={() => void reload()} />
      ) : status !== 'ready' ? (
        <View style={styles.skeleton} accessibilityLabel={t('plan.common.loading')} aria-busy>
          <Skeleton height={120} radius={radius.lg} />
          <Skeleton height={88} radius={radius.lg} />
          <Skeleton height={88} radius={radius.lg} />
        </View>
      ) : (
        children
      )}
    </Screen>
  );
}

/** Tombol tambah. Batas paket tercapai: badge PRO dan ketukan membuka paywall, bukan form. */
export function AddButton({ label, limited, reason, onPress }: { label: string; limited: boolean; reason: string; onPress: () => void }) {
  const paywall = usePaywall();
  return (
    <View style={styles.addRow}>
      {limited && <ProBadge size="sm" />}
      <Button label={label} icon={Plus} size="sm" variant="secondary" onPress={() => (limited ? paywall(reason) : onPress())} />
    </View>
  );
}

/** Error simpan: batas paket = paywall dengan alasannya, selain itu toast. */
export function useSaveError() {
  const t = useT();
  const { show } = useToast();
  const paywall = usePaywall();
  return (e: unknown, reason: string, onLimit?: () => void) => {
    if (e instanceof QuotaError) {
      onLimit?.();
      paywall(reason);
    } else {
      show({ tone: 'error', title: t('plan.common.saveFailed') });
    }
  };
}

/** Pilihan chip sederhana (frekuensi, jenis, siklus). */
export function ChoiceRow<K extends string>({ label, options, value, onChange }: { label: string; options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={styles.choice}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <View style={styles.chips}>
        {options.map((o) => (
          <Chip key={o.key} label={o.label} selected={o.key === value} onPress={() => onChange(o.key)} />
        ))}
      </View>
    </View>
  );
}

/** Lembar isi formulir dengan area gulir dan tombol simpan di bawah. */
export function FormSheet({ visible, onClose, title, subtitle, children, submitLabel, saving, done, onSubmit }: {
  visible: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; submitLabel: string; saving: boolean;
  /** Aksi berhasil: tombol menampilkan centang "Tersimpan" (Motion Kit "Tombol status"). */
  done?: boolean;
  onSubmit: () => void;
}) {
  const t = useT();
  const { height } = useWindowDimensions();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <ScrollView style={{ maxHeight: height * 0.62 }} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      <Button label={done ? t('common.ui.saved') : saving ? t('plan.common.saving') : submitLabel} fullWidth loading={saving && !done} done={done} disabled={saving && !done} onPress={onSubmit} />
    </BottomSheet>
  );
}

/**
 * Bayar / setor / terima dari akun: nominal (mata uang entitas), akun, tanggal. Transaksi dibuat pemanggil.
 * `max` membatasi nominal (sisa utang).
 */
// Ditulis sebagai fungsi biasa: penjaga teks-JSX di i18n.test salah membaca panah + tipe Promise sebagai teks UI.
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
type Confirm = { (): Promise<void> };

export function PaySheet({ visible, onClose, title, note, currency, initial, max, submitLabel, onSubmit, defaultAccountId }: {
  visible: boolean; onClose: () => void; title: string; note: string; currency: string; initial: number | null; max?: number; submitLabel: string;
  /** `confirmed()`: tampilkan centang sebentar; panggil (dan tunggu) setelah berhasil, sebelum menutup lembar. */
  onSubmit(p: PayInput, confirmed: Confirm): Promise<void>; defaultAccountId?: string;
}) {
  const t = useT();
  const accounts = useLedger().accounts;
  const activeId = useActiveAccountId();
  const [amount, setAmount] = useState<number | null>(initial);
  const [accountId, setAccountId] = useState<string | null>(defaultAccountId ?? activeId);
  const [date, setDate] = useState(localYmd());
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const reduced = useReducedMotion();
  // Satu id per lembar: coba ulang setelah gagal memakai id yang sama (lihat PayInput).
  const [payId] = useState(newId);
  const over = max !== undefined && amount !== null && amount > max;
  const amountError = tried && (!amount || amount <= 0) ? t('plan.common.amountError') : over ? t('plan.debts.overpay', { amount: formatMoney(max!, currency) }) : undefined;

  const confirmed = (): Promise<void> => {
    setDone(true);
    return wait(reduced ? 0 : 600);
  };

  const submit = async () => {
    setTried(true);
    if (!amount || amount <= 0 || over || !accountId || !isYmd(date) || saving) return;
    setSaving(true);
    try {
      await onSubmit({ id: payId, amount, accountId, date }, confirmed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet visible={visible} onClose={onClose} title={title} subtitle={note} submitLabel={submitLabel} saving={saving} done={done} onSubmit={() => void submit()}>
      <AmountField label={`${t('plan.common.amount')} (${currency})`} value={amount} onChange={setAmount} currency={currency} error={amountError} />
      {accounts.length === 0 ? (
        <AppText variant="caption" tone="warning">
          {t('plan.common.noAccount')}
        </AppText>
      ) : (
        <AccountPicker label={t('plan.common.account')} accounts={accounts} value={accountId} onChange={setAccountId} />
      )}
      <DateField label={t('plan.common.date')} value={date} onChange={setDate} error={tried && !isYmd(date)} />
    </FormSheet>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <AppText variant="caption" tone="secondary" style={styles.section} accessibilityRole="header">
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  skeleton: { gap: space.lg },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  form: { gap: space.lg, paddingBottom: space.lg },
  choice: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  section: { marginTop: space.sm },
});
