import { CircleCheck, Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Dialog, useToast } from '@/components/ui';
import type { Bill } from '@/data/planning';
import { InfoRow } from '@/features/transactions/InfoRow';
import { categoryLabel, useI18n } from '@/i18n';
import { shortDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { nextDue } from '@/lib/planning/schedule';
import { usePlanning } from '@/state/planning';
import { space } from '@/theme/tokens';

import { BillForm } from './forms';
import { PaySheet } from './kit';

/** Detail tagihan: tandai lunas (buat transaksi + majukan jatuh tempo), ubah, hapus, periode lunas. */
export function BillSheet({ bill, onClose }: { bill: Bill | null; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { payBill, removeBill } = usePlanning();
  const [pay, setPay] = useState(false);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!bill) return null;
  const recent = [...bill.paidPeriods].reverse().slice(0, 6);

  return (
    <>
      <BottomSheet visible={!pay && !edit && !confirm} onClose={onClose} title={bill.name} subtitle={formatMoney(bill.amount, bill.currency)}>
        <View>
          <InfoRow label={t('plan.bills.dueDate')} value={shortDate(bill.dueDate, lang)} divider />
          <InfoRow label={t('plan.bills.frequency')} value={t(`plan.bills.freq.${bill.frequency}`)} divider />
          <InfoRow label={t('plan.bills.category')} value={categoryLabel(t, bill.categoryKey)} divider />
          <InfoRow label={t('plan.bills.paidPeriods')} value={recent.length ? recent.map((d) => shortDate(d, lang)).join(', ') : '-'} />
        </View>
        <View style={styles.actions}>
          <Button label={t('plan.bills.markPaid')} icon={CircleCheck} fullWidth onPress={() => setPay(true)} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button label={t('plan.common.edit')} icon={Pencil} variant="secondary" fullWidth onPress={() => setEdit(true)} />
            </View>
            <View style={styles.flex}>
              <Button label={t('plan.common.delete')} icon={Trash2} variant="danger" fullWidth onPress={() => setConfirm(true)} />
            </View>
          </View>
        </View>
      </BottomSheet>
      <PaySheet
        key={pay ? `pay-${bill.id}-${bill.dueDate}` : 'idle'}
        visible={pay}
        onClose={() => setPay(false)}
        title={t('plan.bills.markPaidTitle', { name: bill.name })}
        note={t('plan.bills.markPaidNote', { date: shortDate(nextDue(bill.dueDate, bill.frequency, bill.anchorDay), lang) })}
        currency={bill.currency}
        initial={bill.amount}
        defaultAccountId={bill.accountId}
        submitLabel={t('plan.bills.markPaid')}
        onSubmit={async (p) => {
          try {
            const next = await payBill(bill, p);
            setPay(false);
            onClose();
            show({ tone: 'success', title: t('plan.bills.paidDone', { name: bill.name, date: shortDate(next.dueDate, lang) }) });
          } catch {
            show({ tone: 'error', title: t('plan.common.saveFailed') });
          }
        }}
      />
      <BillForm key={edit ? `edit-${bill.id}` : 'closed'} visible={edit} onClose={() => { setEdit(false); onClose(); }} bill={bill} />
      <Dialog
        visible={confirm}
        tone="danger"
        title={t('plan.common.deleteTitle', { name: bill.name })}
        message={t('plan.common.deleteMessage')}
        confirmLabel={t('plan.common.delete')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          removeBill(bill.id)
            .then(() => {
              onClose();
              show({ tone: 'success', title: t('plan.common.deleted') });
            })
            .catch(() => show({ tone: 'error', title: t('plan.common.deleteFailed') }));
        }}
      />
    </>
  );
}

export function dueLabel(t: ReturnType<typeof useI18n>['t'], lang: ReturnType<typeof useI18n>['lang'], days: number, date: string): string {
  if (days < 0) return t('plan.bills.overdueBadge', { days: -days });
  if (days === 0) return t('plan.bills.dueToday');
  return t('plan.bills.dueIn', { date: shortDate(date, lang) });
}

const styles = StyleSheet.create({
  actions: { gap: space.sm, marginTop: space.lg },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});
