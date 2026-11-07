import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck, FileText, Pencil, Send, Share2, Trash2, Undo2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Dialog, EmptyState, useToast } from '@/components/ui';
import { localYmd } from '@/features/capture/clock';
import { InvoiceScreen, StatusBadge } from '@/features/invoice/kit';
import { DateField, FormSheet, isYmd, SectionLabel, useSaveError } from '@/features/planning/kit';
import { invoiceDocument } from '@/features/tools/documents';
import { ResultRow, usePdfShare } from '@/features/tools/kit';
import { AccountPicker } from '@/features/transactions/pickers';
import { InfoRow } from '@/features/transactions/InfoRow';
import { useI18n } from '@/i18n';
import { isoDateLabel, shortDate } from '@/lib/dates';
import { lineTotal, qtyText, type Invoice } from '@/lib/invoice';
import { formatMoney } from '@/lib/money';
import { QUOTAS } from '@/lib/quota';
import { bpText } from '@/lib/tax';
import { useActiveAccountId, useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';
import { useInvoices } from '@/state/invoices';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

/** Detail invoice/penawaran: dokumen, status, tandai Dibayar (satu transaksi pemasukan), PDF. */
export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const { invoices } = useInvoices();
  const inv = invoices.find((i) => i.id === id);
  return (
    <InvoiceScreen title={inv ? (inv.kind === 'invoice' ? t('inv.invoiceTitle') : t('inv.quoteTitle')) : t('inv.title')}>
      {inv ? (
        <Detail inv={inv} />
      ) : (
        <EmptyState title={t('inv.notFoundTitle')} message={t('inv.notFoundMessage')} actionLabel={t('plan.common.back')} onAction={() => router.back()} />
      )}
    </InvoiceScreen>
  );
}

function Detail({ inv }: { inv: Invoice }) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const saveError = useSaveError();
  const { state } = useStore();
  const { setStatus, remove, markPaid } = useInvoices();
  const pdf = usePdfShare();
  const [paying, setPaying] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const money = (v: number) => formatMoney(v, inv.currency);
  const decimal = lang === 'id' || lang === 'tr' ? ',' : '.';
  const isInvoice = inv.kind === 'invoice';
  const paid = inv.status === 'paid';
  const account = inv.accountId ? state.accounts.find((a) => a.id === inv.accountId) : undefined;
  const tx = state.transactions.find((x) => x.id === inv.transactionId);

  const changeStatus = async (s: 'draft' | 'sent' | 'accepted') => {
    setBusy(true);
    try {
      await setStatus(inv.id, s);
      show({ tone: 'success', title: t(`inv.statusChanged.${s}`) });
    } catch {
      show({ tone: 'error', title: t('plan.common.saveFailed') });
    } finally {
      setBusy(false);
    }
  };

  const sharePdf = () =>
    pdf.run(() => invoiceDocument(inv, { t, lang, owner: state.displayName ?? '', accent: colors.accent }), inv.number);

  return (
    <>
      <Card padding="lg">
        <View style={styles.head}>
          <AppText variant="h3" numberOfLines={1} style={styles.flex}>
            {inv.number}
          </AppText>
          <StatusBadge inv={inv} today={localYmd()} />
        </View>
        <AppText variant="body" tone="secondary" numberOfLines={2}>
          {inv.clientContact ? `${inv.clientName} · ${inv.clientContact}` : inv.clientName}
        </AppText>
        <AppText variant="amountHero" numeric adjustsFontSizeToFit numberOfLines={1} style={styles.total}>
          {money(inv.total)}
        </AppText>
        <InfoRow label={t('inv.doc.issued')} value={shortDate(inv.issueDate, lang)} />
        {inv.dueDate ? <InfoRow label={isInvoice ? t('inv.doc.due') : t('inv.doc.validUntil')} value={shortDate(inv.dueDate, lang)} /> : null}
        {paid && inv.paidAt ? (
          <InfoRow label={t('inv.paidOn')} value={account ? t('inv.paidTo', { date: isoDateLabel(inv.paidAt, lang), account: account.name }) : isoDateLabel(inv.paidAt, lang)} />
        ) : null}
      </Card>

      {paid && tx ? <Button label={t('inv.openTransaction')} variant="secondary" fullWidth onPress={() => router.push({ pathname: '/trx/[id]', params: { id: tx.id } })} /> : null}
      {isInvoice && !paid && <Button label={t('inv.markPaid')} icon={CircleCheck} fullWidth onPress={() => setPaying(true)} />}
      {!isInvoice && inv.status === 'accepted' && (
        <Button label={t('inv.toInvoice')} icon={FileText} fullWidth onPress={() => router.push({ pathname: '/invoice/form', params: { dari: inv.id } })} />
      )}

      <SectionLabel>{t('inv.form.items')}</SectionLabel>
      <Card padding="md">
        {inv.items.map((i) => (
          <View key={i.id} style={styles.item}>
            <View style={styles.flex}>
              <AppText variant="body">{i.name}</AppText>
              <AppText variant="caption" tone="secondary" numeric>
                {`${qtyText(i.qty, decimal)} × ${money(i.unitPrice)}`}
              </AppText>
            </View>
            <AppText variant="bodyStrong" numeric>
              {money(lineTotal(i))}
            </AppText>
          </View>
        ))}
        <View style={styles.totals}>
          <ResultRow label={t('inv.doc.subtotal')} value={money(inv.subtotal)} />
          {inv.discount > 0 && <ResultRow label={t('inv.doc.discount')} value={money(inv.discount)} minus />}
          {inv.taxBp > 0 && <ResultRow label={t('inv.doc.tax', { rate: bpText(inv.taxBp, decimal) })} value={money(inv.tax)} />}
          <ResultRow label={t('inv.doc.total')} value={money(inv.total)} strong />
        </View>
      </Card>
      {inv.notes ? (
        <Card variant="outline" padding="md">
          <AppText variant="caption" tone="secondary">
            {t('inv.doc.notes')}
          </AppText>
          <AppText variant="body">{inv.notes}</AppText>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button label={pdf.busy ? t('tools.pdf.making') : t('inv.sharePdf')} icon={Share2} variant="secondary" fullWidth loading={pdf.busy} disabled={pdf.busy} onPress={() => void sharePdf()} />
        {inv.status === 'draft' && <Button label={t('inv.markSent')} icon={Send} variant="secondary" fullWidth disabled={busy} onPress={() => void changeStatus('sent')} />}
        {!isInvoice && inv.status !== 'accepted' && <Button label={t('inv.markAccepted')} icon={CircleCheck} variant="secondary" fullWidth disabled={busy} onPress={() => void changeStatus('accepted')} />}
        {(inv.status === 'sent' || inv.status === 'accepted') && <Button label={t('inv.backToDraft')} icon={Undo2} variant="ghost" fullWidth disabled={busy} onPress={() => void changeStatus('draft')} />}
        {!paid && <Button label={t('plan.common.edit')} icon={Pencil} variant="secondary" fullWidth onPress={() => router.push({ pathname: '/invoice/form', params: { id: inv.id } })} />}
        <Button label={t('plan.common.delete')} icon={Trash2} variant="danger" fullWidth onPress={() => setConfirm(true)} />
      </View>
      {paid && (
        <AppText variant="caption" tone="muted">
          {t('inv.paidLocked')}
        </AppText>
      )}

      <PaidSheet
        key={paying ? 'open' : 'closed'}
        inv={inv}
        visible={paying}
        onClose={() => setPaying(false)}
        onSubmit={async (p) => {
          try {
            await markPaid(inv, p);
            setPaying(false);
            show({ tone: 'success', title: t('inv.paidDone', { amount: money(inv.total) }) });
          } catch (e) {
            saveError(e, t('inv.limitReason', { free: QUOTAS.free.invoice ?? 0 }));
          }
        }}
      />
      <Dialog
        visible={confirm}
        tone="danger"
        title={t('plan.common.deleteTitle', { name: inv.number })}
        message={paid ? t('inv.deletePaidMessage') : t('inv.deleteMessage')}
        confirmLabel={t('plan.common.delete')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          remove(inv.id)
            .then(() => {
              show({ tone: 'success', title: t('plan.common.deleted') });
              router.back();
            })
            .catch(() => show({ tone: 'error', title: t('plan.common.deleteFailed') }));
        }}
      />
    </>
  );
}

/** Tandai Dibayar: pilih akun penerima dan tanggal. Nominal = total invoice, mata uang invoice. */
type PaidSheetProps = { inv: Invoice; visible: boolean; onClose(): void; onSubmit(p: { accountId: string; date: string }): Promise<void> };

function PaidSheet({ inv, visible, onClose, onSubmit }: PaidSheetProps) {
  const { t } = useI18n();
  const accounts = useLedger().accounts;
  const activeId = useActiveAccountId();
  const [accountId, setAccountId] = useState<string | null>(accounts.find((a) => a.currency === inv.currency)?.id ?? activeId);
  const [date, setDate] = useState(localYmd());
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const account = accounts.find((a) => a.id === accountId);

  const submit = async () => {
    setTried(true);
    if (!accountId || !isYmd(date) || saving) return;
    setSaving(true);
    try {
      await onSubmit({ accountId, date });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title={t('inv.paidTitle', { number: inv.number })}
      subtitle={t('inv.paidNote', { amount: formatMoney(inv.total, inv.currency) })}
      submitLabel={t('inv.paidCta')}
      saving={saving}
      onSubmit={() => void submit()}
    >
      {accounts.length === 0 ? (
        <AppText variant="caption" tone="warning">
          {t('plan.common.noAccount')}
        </AppText>
      ) : (
        <AccountPicker label={t('inv.paidAccount')} accounts={accounts} value={accountId} onChange={setAccountId} error={tried && !accountId ? t('inv.paidAccountError') : undefined} />
      )}
      {account && account.currency !== inv.currency ? (
        <AppText variant="caption" tone="secondary">
          {t('inv.paidFx', { from: inv.currency, to: account.currency })}
        </AppText>
      ) : null}
      <DateField label={t('inv.paidDate')} value={date} onChange={setDate} error={tried && !isYmd(date)} />
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  total: { marginTop: space.md, marginBottom: space.sm },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm },
  totals: { marginTop: space.sm },
  actions: { gap: space.sm, marginTop: space.sm },
});
