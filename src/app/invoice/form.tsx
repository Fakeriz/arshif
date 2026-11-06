import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CurrencySheet } from '@/components/shell/CurrencySheet';
import { AmountField, AppText, Button, Card, EmptyState, Icon, Input, ListItem, PressableScale, useToast } from '@/components/ui';
import { localYmd } from '@/features/capture/clock';
import { InvoiceScreen } from '@/features/invoice/kit';
import { DateField, isYmd, SectionLabel, useSaveError } from '@/features/planning/kit';
import { ResultRow } from '@/features/tools/kit';
import { currencyName, useI18n } from '@/i18n';
import { addDays } from '@/lib/dates';
import { invoiceTotals, parsePercentBp, parseQty, qtyText, type Invoice, type InvoiceKind } from '@/lib/invoice';
import { currencyMeta, formatMoney } from '@/lib/money';
import { QUOTAS } from '@/lib/quota';
import { bpText } from '@/lib/tax';
import { newId } from '@/lib/uuid';
import { useStore } from '@/state/AppStore';
import { useInvoices } from '@/state/invoices';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

type Draft = { id: string; name: string; qty: string; price: number | null };

/**
 * Buat / ubah invoice atau penawaran (FR-INV-1). ?id= ubah, ?jenis=invoice|quote baru, ?dari=<id penawaran>
 * = invoice baru berisi data penawaran itu. Nomor dan jumlah akhir dihitung server.
 */
export default function InvoiceForm() {
  const { id, jenis, dari } = useLocalSearchParams<{ id?: string; jenis?: InvoiceKind; dari?: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const { invoices } = useInvoices();
  const existing = id ? invoices.find((i) => i.id === id) : undefined;
  const source = dari ? invoices.find((i) => i.id === dari) : undefined;
  const kind: InvoiceKind = existing?.kind ?? (source ? 'invoice' : jenis === 'quote' ? 'quote' : 'invoice');
  const title = existing ? t('inv.form.editTitle', { number: existing.number }) : kind === 'invoice' ? t('inv.newInvoice') : t('inv.newQuote');

  return (
    <InvoiceScreen title={title}>
      {id && !existing ? (
        <EmptyState title={t('inv.notFoundTitle')} message={t('inv.notFoundMessage')} actionLabel={t('plan.common.back')} onAction={() => router.back()} />
      ) : existing?.status === 'paid' ? (
        <EmptyState title={t('inv.form.lockedTitle')} message={t('inv.form.lockedMessage')} actionLabel={t('plan.common.back')} onAction={() => router.back()} />
      ) : (
        <Form key={existing?.id ?? source?.id ?? kind} kind={kind} initial={existing ?? source} isEdit={!!existing} />
      )}
    </InvoiceScreen>
  );
}

function Form({ kind, initial, isEdit }: { kind: InvoiceKind; initial?: Invoice; isEdit: boolean }) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const saveError = useSaveError();
  const { state } = useStore();
  const { create, update } = useInvoices();
  const decimal = lang === 'id' || lang === 'tr' ? ',' : '.';
  const today = localYmd();

  const [client, setClient] = useState(initial?.clientName ?? '');
  const [contact, setContact] = useState(initial?.clientContact ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? state.mainCurrency);
  const [picking, setPicking] = useState(false);
  // Penawaran yang dijadikan invoice: tanggal terbit baru, jatuh tempo kosong.
  const [issue, setIssue] = useState(isEdit && initial ? initial.issueDate : today);
  const [due, setDue] = useState(isEdit && initial?.dueDate ? initial.dueDate : isEdit ? '' : addDays(today, kind === 'invoice' ? 14 : 30));
  const [items, setItems] = useState<Draft[]>(
    initial?.items.map((i) => ({ id: newId(), name: i.name, qty: qtyText(i.qty, decimal), price: i.unitPrice })) ?? [{ id: newId(), name: '', qty: '1', price: null }],
  );
  const [discount, setDiscount] = useState<number | null>(initial?.discount || null);
  const [taxText, setTaxText] = useState(initial?.taxBp ? bpText(initial.taxBp, decimal) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const parsed = items.map((d) => ({ name: d.name.trim(), qty: parseQty(d.qty), price: d.price }));
  const valid = parsed.filter((p) => p.name && p.qty !== null && p.price !== null && p.price >= 0) as { name: string; qty: number; price: number }[];
  const taxBp = parsePercentBp(taxText);
  const totals = invoiceTotals(valid.map((v) => ({ qty: v.qty, unitPrice: v.price })), discount ?? 0, taxBp ?? 0);
  const money = (v: number) => formatMoney(v, currency);

  const errors = {
    client: tried && !client.trim() ? t('inv.form.clientError') : undefined,
    issue: tried && !isYmd(issue),
    due: tried && !!due && (!isYmd(due) || due < issue),
    items: tried && (valid.length === 0 || valid.length !== items.length) ? t('inv.form.itemsError') : undefined,
    tax: taxText.trim() && taxBp === null ? t('inv.form.taxError') : undefined,
    discount: (discount ?? 0) > totals.subtotal && totals.subtotal > 0 ? t('inv.form.discountError') : undefined,
    total: tried && valid.length > 0 && totals.total <= 0 ? t('inv.form.totalError') : undefined,
  };

  const setItem = (id: string, patch: Partial<Draft>) => setItems((l) => l.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const save = async () => {
    setTried(true);
    const bad = !client.trim() || !isYmd(issue) || (due && (!isYmd(due) || due < issue)) || valid.length === 0 || valid.length !== items.length || taxBp === null || errors.discount || totals.total <= 0;
    if (bad || saving) return;
    setSaving(true);
    const input = {
      clientName: client.trim(), clientContact: contact.trim() || undefined, issueDate: issue, dueDate: due || undefined, currency,
      items: valid.map((v) => ({ id: newId(), name: v.name, qty: v.qty, unitPrice: v.price })), discount: discount ?? 0, taxBp: taxBp ?? 0, notes: notes.trim() || undefined,
    };
    try {
      const saved = isEdit && initial ? await update(initial.id, input) : await create(kind, input);
      show({ tone: 'success', title: isEdit ? t('inv.form.updated') : t('inv.form.created', { number: saved.number }) });
      router.replace({ pathname: '/invoice/[id]', params: { id: saved.id } });
    } catch (e) {
      saveError(e, t('inv.limitReason', { free: QUOTAS.free.invoice ?? 0 }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionLabel>{kind === 'invoice' ? t('inv.form.billTo') : t('inv.form.preparedFor')}</SectionLabel>
      <Card padding="lg">
        <View style={styles.form}>
          <Input label={t('inv.form.client')} value={client} onChangeText={setClient} maxLength={80} placeholder={t('inv.form.clientPlaceholder')} error={errors.client} />
          <Input label={t('inv.form.contact')} value={contact} onChangeText={setContact} maxLength={120} autoCapitalize="none" placeholder={t('inv.form.contactPlaceholder')} />
        </View>
      </Card>

      <SectionLabel>{t('inv.form.details')}</SectionLabel>
      <Card padding="lg">
        <View style={styles.form}>
          <ListItem title={t('inv.form.currency')} subtitle={`${currency} · ${currencyName(t, currency)}`} chevron onPress={() => setPicking(true)} />
          <DateField label={t('inv.form.issue')} value={issue} onChange={setIssue} error={errors.issue} />
          <DateField label={kind === 'invoice' ? t('inv.form.due') : t('inv.form.validUntil')} value={due} onChange={setDue} error={errors.due} optional />
        </View>
      </Card>

      <SectionLabel>{t('inv.form.items')}</SectionLabel>
      <Card padding="lg">
        {errors.items ? (
          <AppText variant="caption" tone="negative" style={styles.gapBottom}>
            {errors.items}
          </AppText>
        ) : null}
        {items.map((d, i) => {
          const q = parseQty(d.qty);
          return (
            <View key={d.id} style={[styles.item, i < items.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.itemHead}>
                <AppText variant="caption" tone="secondary" style={styles.flex}>
                  {t('inv.form.itemN', { n: i + 1 })}
                </AppText>
                {items.length > 1 && (
                  <PressableScale accessibilityLabel={t('inv.form.removeItem', { n: i + 1 })} onPress={() => setItems((l) => l.filter((x) => x.id !== d.id))} style={styles.iconBtn} focusRadius={radius.full}>
                    <Icon icon={Trash2} color={colors.textSecondary} size={18} />
                  </PressableScale>
                )}
              </View>
              <Input label={t('inv.form.itemName')} value={d.name} onChangeText={(v) => setItem(d.id, { name: v })} maxLength={120} placeholder={t('inv.form.itemPlaceholder')} />
              <View style={styles.pair}>
                <View style={styles.qty}>
                  <Input
                    label={t('inv.form.qty')}
                    value={d.qty}
                    onChangeText={(v) => setItem(d.id, { qty: v })}
                    keyboardType="decimal-pad"
                    maxLength={9}
                    error={d.qty.trim() && q === null ? t('inv.form.qtyError') : undefined}
                  />
                </View>
                <View style={styles.flex}>
                  <AmountField label={t('inv.form.unitPrice')} value={d.price} onChange={(v) => setItem(d.id, { price: v })} currency={currency} />
                </View>
              </View>
            </View>
          );
        })}
        <Button label={t('inv.form.addItem')} icon={Plus} variant="secondary" size="sm" onPress={() => setItems((l) => [...l, { id: newId(), name: '', qty: '1', price: null }])} disabled={items.length >= 50} />
      </Card>

      <SectionLabel>{t('inv.form.adjust')}</SectionLabel>
      <Card padding="lg">
        <View style={styles.form}>
          <AmountField label={t('inv.form.discount')} value={discount} onChange={setDiscount} currency={currency} error={errors.discount} />
          <Input label={t('inv.form.tax')} value={taxText} onChangeText={setTaxText} keyboardType="decimal-pad" maxLength={6} placeholder="0" error={errors.tax} hint={t('inv.form.taxHint')} />
          <Input label={t('inv.form.notes')} value={notes} onChangeText={setNotes} maxLength={500} multiline placeholder={t('inv.form.notesPlaceholder')} />
        </View>
      </Card>

      <Card padding="lg">
        <ResultRow label={t('inv.doc.subtotal')} value={money(totals.subtotal)} />
        {totals.discount > 0 && <ResultRow label={t('inv.doc.discount')} value={money(totals.discount)} minus />}
        {(taxBp ?? 0) > 0 && <ResultRow label={t('inv.doc.tax', { rate: bpText(taxBp ?? 0, decimal) })} value={money(totals.tax)} />}
        <ResultRow label={t('inv.doc.total')} value={money(totals.total)} strong />
        {errors.total ? (
          <AppText variant="caption" tone="negative">
            {errors.total}
          </AppText>
        ) : null}
      </Card>
      {!isEdit && (
        <AppText variant="caption" tone="muted">
          {t('inv.form.numberNote')}
        </AppText>
      )}
      <Button label={saving ? t('plan.common.saving') : isEdit ? t('inv.form.saveChanges') : kind === 'invoice' ? t('inv.form.createInvoice') : t('inv.form.createQuote')} fullWidth loading={saving} disabled={saving} onPress={() => void save()} />
      <CurrencySheet
        visible={picking}
        value={currency}
        onClose={() => setPicking(false)}
        onSelect={(code) => {
          // Jumlah desimal beda (IDR tanpa sen, USD dengan sen): nominal lama tidak lagi berarti sama, jadi dikosongkan.
          if (currencyMeta(code).exponent !== currencyMeta(currency).exponent) {
            setItems((l) => l.map((d) => ({ ...d, price: null })));
            setDiscount(null);
          }
          setCurrency(code);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  item: { gap: space.md, paddingBottom: space.lg, marginBottom: space.lg },
  itemHead: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pair: { flexDirection: 'row', gap: space.md },
  qty: { width: 96 },
  flex: { flex: 1, minWidth: 0 },
  gapBottom: { marginBottom: space.md },
});
