import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Share2, Trash2, UserPlus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { AmountField, AppText, Button, Card, Checkbox, Chip, Dialog, EmptyState, Icon, Input, PressableScale, Tabs, Toggle, useToast } from '@/components/ui';
import type { SplitBill, SplitItem, SplitParticipant } from '@/data/planning';
import { localYmd } from '@/features/capture/clock';
import { PlanScreen, SectionLabel, useSaveError } from '@/features/planning/kit';
import { useI18n } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { computeShares, shareText } from '@/lib/planning/split';
import { itemPaid } from '@/lib/receipt';
import { newId } from '@/lib/uuid';
import { useStore } from '@/state/AppStore';
import { usePlanning } from '@/state/planning';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/**
 * Split bill (FR-SPLIT-1..3). id "baru" = baru (opsional ?tx= untuk mengisi dari struk). Bagi rata atau per item;
 * pajak dan service charge ikut proporsional; sisa pembulatan ke pembayar. Pembayaran di aplikasi tidak ada:
 * status sudah bayar dicatat manual, bagian yang belum bayar bisa jadi piutang.
 */
export default function SplitEditor() {
  const { id, tx: txId } = useLocalSearchParams<{ id: string; tx?: string }>();
  const { splits, status } = usePlanning();
  const { state } = useStore();
  const isNew = id === 'baru';
  const existing = isNew ? undefined : splits.find((s) => s.id === id);
  const tx = isNew && txId ? state.transactions.find((x) => x.id === txId) : undefined;
  const { t } = useI18n();
  const router = useRouter();
  if (status === 'ready' && !isNew && !existing) {
    return (
      <PlanScreen title={t('plan.split.title')}>
        <EmptyState title={t('plan.common.notFound')} message={t('plan.common.notFoundMessage')} actionLabel={t('plan.common.back')} onAction={() => router.back()} />
      </PlanScreen>
    );
  }
  const initial: SplitBill =
    existing ??
    (() => {
      const owner: SplitParticipant = { id: newId(), name: state.displayName || t('plan.split.me'), owner: true, share: 0 };
      const items: SplitItem[] = (tx?.items ?? []).map((i) => ({ id: newId(), name: i.name, amount: itemPaid(i), assigned: [] }));
      const added = tx?.receipt?.taxIncluded === false ? (tx.receipt.taxTotal ?? 0) : 0;
      return {
        id: newId(), title: tx?.merchant ?? '', currency: tx?.currency ?? state.mainCurrency, total: tx?.amount ?? 0, tax: added, service: tx?.receipt?.service ?? 0,
        mode: items.length ? 'items' : 'equal', date: tx?.date ?? localYmd(), transactionId: tx?.id, items, participants: [owner],
      };
    })();
  return (
    <PlanScreen title={isNew ? t('plan.split.newTitle') : t('plan.split.editTitle')}>
      <Editor key={initial.id} initial={initial} isNew={isNew} fixedTotal={!!initial.transactionId} />
    </PlanScreen>
  );
}

function Editor({ initial, isNew, fixedTotal }: { initial: SplitBill; isNew: boolean; fixedTotal: boolean }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const saveError = useSaveError();
  const { debts, saveSplit, removeSplit, addDebt, settleDebt } = usePlanning();
  const [title, setTitle] = useState(initial.title);
  const [mode, setMode] = useState(initial.mode);
  const [total, setTotal] = useState<number | null>(initial.total || null);
  const [tax, setTax] = useState<number | null>(initial.tax || null);
  const [service, setService] = useState<number | null>(initial.service || null);
  const [items, setItems] = useState<SplitItem[]>(initial.items);
  const [people, setPeople] = useState<SplitParticipant[]>(initial.participants);
  const [newName, setNewName] = useState('');
  const [newContact, setNewContact] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemAmount, setItemAmount] = useState<number | null>(null);
  const [asReceivable, setAsReceivable] = useState(people.some((p) => p.debtId));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const cur = initial.currency;
  const money = (v: number) => formatMoney(v, cur);

  const itemsSum = items.reduce((s, i) => s + i.amount, 0);
  // Per item tanpa struk: total = item + pajak + service. Dari struk: total transaksi (tetap).
  const billTotal = mode === 'items' && !fixedTotal ? itemsSum + (tax ?? 0) + (service ?? 0) : (total ?? 0);
  const shares = useMemo(() => computeShares({ mode, total: billTotal, participants: people, items }), [mode, billTotal, people, items]);
  const others = people.filter((p) => !p.owner);
  const paidCount = others.filter((p) => p.paidAt).length;
  const errors = {
    title: tried && !title.trim() ? t('plan.common.nameError') : undefined,
    total: tried && billTotal <= 0 ? t('plan.common.amountError') : undefined,
    people: tried && others.length === 0 ? t('plan.split.needPeople') : undefined,
    items: tried && mode === 'items' && items.length === 0 ? t('plan.split.needItems') : undefined,
    mismatch: mode === 'items' && fixedTotal && itemsSum > billTotal ? t('plan.split.itemsMismatch', { items: money(itemsSum), total: money(billTotal) }) : undefined,
  };

  const addPerson = () => {
    if (!newName.trim()) return;
    setPeople((list) => [...list, { id: newId(), name: newName.trim().slice(0, 60), contact: newContact.trim() || undefined, owner: false, share: 0 }]);
    setNewName('');
    setNewContact('');
  };
  const addItem = () => {
    if (!itemName.trim() || !itemAmount || itemAmount <= 0) return;
    setItems((list) => [...list, { id: newId(), name: itemName.trim().slice(0, 80), amount: itemAmount, assigned: [] }]);
    setItemName('');
    setItemAmount(null);
  };
  const toggleAssign = (itemId: string, personId: string) =>
    setItems((list) => list.map((i) => (i.id !== itemId ? i : { ...i, assigned: i.assigned.includes(personId) ? i.assigned.filter((x) => x !== personId) : [...i.assigned, personId] })));

  const build = (participants: SplitParticipant[]): SplitBill => ({
    ...initial, title: title.trim(), mode, total: billTotal, tax: tax ?? 0, service: service ?? 0, items: mode === 'items' ? items : [],
    participants: participants.map((p) => ({ ...p, share: shares[p.id] ?? 0 })),
  });

  const save = async () => {
    setTried(true);
    if (!title.trim() || billTotal <= 0 || others.length === 0 || (mode === 'items' && items.length === 0) || errors.mismatch || saving) return;
    setSaving(true);
    try {
      let saved = await saveSplit(build(people), isNew);
      // Piutang dibuat setelah split tersimpan (piutang merujuk split). Batas paket = paywall, split tetap tersimpan.
      if (asReceivable) {
        let next = saved.participants;
        try {
          for (const p of saved.participants) {
            if (p.owner || p.paidAt || p.debtId || p.share <= 0) continue;
            const debt = await addDebt({ kind: 'receivable', counterparty: p.name, contact: p.contact, principal: p.share, aprBp: 0, minPayment: 0, currency: cur, splitBillId: saved.id, dueDate: undefined, note: undefined });
            next = next.map((x) => (x.id === p.id ? { ...x, debtId: debt.id } : x));
          }
        } catch (e) {
          saveError(e, t('plan.debts.limitReason'));
        }
        if (next !== saved.participants) saved = await saveSplit({ ...saved, participants: next }, false);
      }
      setPeople(saved.participants);
      show({ tone: 'success', title: t('plan.common.saved') });
      if (isNew) router.replace({ pathname: '/rencana/split/[id]', params: { id: saved.id } });
    } catch (e) {
      saveError(e, t('plan.debts.limitReason'));
    } finally {
      setSaving(false);
    }
  };

  const togglePaid = async (p: SplitParticipant, paid: boolean) => {
    const next = people.map((x) => (x.id === p.id ? { ...x, paidAt: paid ? localYmd() : undefined } : x));
    setPeople(next);
    try {
      // Split yang sudah tersimpan: status bayar langsung disimpan, tidak menunggu tombol Simpan.
      if (!isNew) await saveSplit(build(next), false);
      // Piutang terkait ditutup (tanpa transaksi: uangnya diterima di luar aplikasi).
      const debt = paid && p.debtId ? debts.find((d) => d.id === p.debtId && d.status === 'active') : undefined;
      if (debt) await settleDebt(debt, localYmd());
    } catch {
      show({ tone: 'error', title: t('plan.common.saveFailed') });
    }
  };

  const share = () => {
    const message = shareText({
      title: title.trim() || t('plan.split.title'),
      total: money(billTotal),
      totalLabel: t('plan.split.shareTotal'),
      paidLabel: t('plan.split.sharePaid'),
      unpaidLabel: t('plan.split.shareUnpaid'),
      people: people.map((p) => ({ name: p.name, amount: money(shares[p.id] ?? 0), paid: p.owner || !!p.paidAt })),
    });
    void Share.share({ message }).catch(() => undefined);
  };

  return (
    <>
      <Input label={t('plan.split.billTitle')} value={title} onChangeText={setTitle} placeholder={t('plan.split.billTitlePlaceholder')} maxLength={80} error={errors.title} />
      <Tabs accessibilityLabel={t('plan.split.mode')} value={mode} onChange={setMode} items={[{ key: 'equal', label: t('plan.split.modes.equal') }, { key: 'items', label: t('plan.split.modes.items') }]} />
      {mode === 'equal' || fixedTotal ? (
        <AmountField label={`${t('plan.split.total')} (${cur})`} value={total} onChange={setTotal} currency={cur} error={errors.total} disabled={fixedTotal} />
      ) : (
        <View style={styles.pair}>
          <View style={styles.flex}>
            <AmountField label={t('plan.split.tax')} value={tax} onChange={setTax} currency={cur} />
          </View>
          <View style={styles.flex}>
            <AmountField label={t('plan.split.service')} value={service} onChange={setService} currency={cur} />
          </View>
        </View>
      )}

      <SectionLabel>{t('plan.split.people')}</SectionLabel>
      <Card padding="md">
        {people.map((p) => (
          <View key={p.id} style={styles.personRow}>
            <AppText variant="body" numberOfLines={1} style={styles.flex}>
              {p.owner ? `${p.name} · ${t('plan.split.owner')}` : p.contact ? `${p.name} · ${p.contact}` : p.name}
            </AppText>
            {!p.owner && (
              <PressableScale accessibilityLabel={t('plan.split.removePerson', { name: p.name })} onPress={() => setPeople((l) => l.filter((x) => x.id !== p.id))} style={styles.iconBtn} focusRadius={radius.full}>
                <Icon icon={X} color={colors.textSecondary} size={18} />
              </PressableScale>
            )}
          </View>
        ))}
        <View style={styles.addBlock}>
          <Input label={t('plan.split.personName')} value={newName} onChangeText={setNewName} maxLength={60} onSubmitEditing={addPerson} error={errors.people} />
          <Input label={t('plan.split.personContact')} value={newContact} onChangeText={setNewContact} maxLength={80} autoCapitalize="none" />
          <Button label={t('plan.split.addPerson')} icon={UserPlus} variant="secondary" size="sm" onPress={addPerson} disabled={!newName.trim()} />
        </View>
      </Card>

      {mode === 'items' && (
        <>
          <SectionLabel>{t('plan.split.items')}</SectionLabel>
          <Card padding="md">
            {errors.items ? (
              <AppText variant="caption" tone="negative">
                {errors.items}
              </AppText>
            ) : null}
            {items.map((it) => (
              <View key={it.id} style={[styles.item, { borderBottomColor: colors.border }]}>
                <View style={styles.personRow}>
                  <AppText variant="body" numberOfLines={1} style={styles.flex}>
                    {it.name}
                  </AppText>
                  <AppText variant="bodyStrong" numeric>
                    {money(it.amount)}
                  </AppText>
                  <PressableScale accessibilityLabel={t('plan.split.removeItem', { name: it.name })} onPress={() => setItems((l) => l.filter((x) => x.id !== it.id))} style={styles.iconBtn} focusRadius={radius.full}>
                    <Icon icon={Trash2} color={colors.textSecondary} size={16} />
                  </PressableScale>
                </View>
                <View style={styles.chips} accessibilityLabel={t('plan.split.assign')}>
                  {people.map((p) => (
                    <Chip key={p.id} label={p.owner ? t('plan.split.me') : p.name} selected={it.assigned.includes(p.id)} onPress={() => toggleAssign(it.id, p.id)} />
                  ))}
                </View>
                {it.assigned.length === 0 && (
                  <AppText variant="caption" tone="muted">
                    {t('plan.split.unassigned')}
                  </AppText>
                )}
              </View>
            ))}
            {!fixedTotal && (
              <View style={styles.addBlock}>
                <Input label={t('plan.split.itemName')} value={itemName} onChangeText={setItemName} maxLength={80} />
                <AmountField label={`${t('plan.split.itemAmount')} (${cur})`} value={itemAmount} onChange={setItemAmount} currency={cur} />
                <Button label={t('plan.split.addItem')} icon={Plus} variant="secondary" size="sm" onPress={addItem} disabled={!itemName.trim() || !itemAmount} />
              </View>
            )}
            {errors.mismatch ? (
              <AppText variant="caption" tone="warning">
                {errors.mismatch}
              </AppText>
            ) : null}
          </Card>
        </>
      )}

      <SectionLabel>{t('plan.split.shares')}</SectionLabel>
      <Card padding="md">
        {people.map((p) => (
          <View key={p.id} style={styles.shareRow}>
            {p.owner ? (
              <View style={styles.checkSpace} />
            ) : (
              <Checkbox checked={!!p.paidAt} onChange={(v) => void togglePaid(p, v)} accessibilityLabel={t('plan.split.paidToggle', { name: p.name })} />
            )}
            <View style={styles.flex}>
              <AppText variant="body" numberOfLines={1}>
                {p.owner ? `${p.name} · ${t('plan.split.owner')}` : p.name}
              </AppText>
              {p.debtId ? (
                <AppText variant="caption" tone="muted">
                  {t('plan.split.receivableLinked')}
                </AppText>
              ) : null}
            </View>
            <AppText variant="bodyStrong" numeric tone={!p.owner && p.paidAt ? 'positive' : undefined}>
              {money(shares[p.id] ?? 0)}
            </AppText>
          </View>
        ))}
        <AppText variant="caption" tone="secondary" style={styles.gapTop}>
          {t('plan.split.sumCheck', { sum: money(Object.values(shares).reduce((a, b) => a + b, 0)), total: money(billTotal) })}
        </AppText>
        <AppText variant="caption" tone="muted">
          {t('plan.split.sharesNote')}
        </AppText>
        {others.length > 0 && (
          <AppText variant="caption" tone="secondary" style={styles.gapTop}>
            {t('plan.split.paidCount', { paid: paidCount, count: others.length })}
          </AppText>
        )}
      </Card>

      <Card padding="md">
        <View style={styles.toggleRow}>
          <View style={styles.flex}>
            <AppText variant="body">{t('plan.split.receivable')}</AppText>
            <AppText variant="caption" tone="secondary">
              {t('plan.split.receivableHint')}
            </AppText>
          </View>
          <Toggle value={asReceivable} onChange={setAsReceivable} accessibilityLabel={t('plan.split.receivable')} />
        </View>
      </Card>
      <AppText variant="caption" tone="muted">
        {t('plan.split.noPayment')}
      </AppText>

      <View style={styles.actions}>
        <Button label={saving ? t('plan.common.saving') : t('plan.common.save')} fullWidth loading={saving} disabled={saving} onPress={() => void save()} />
        <Button label={t('plan.split.share')} icon={Share2} variant="secondary" fullWidth onPress={share} disabled={others.length === 0 || billTotal <= 0} />
        {!isNew && <Button label={t('plan.common.delete')} icon={Trash2} variant="danger" fullWidth onPress={() => setConfirm(true)} />}
      </View>
      <Dialog
        visible={confirm}
        tone="danger"
        title={t('plan.common.deleteTitle', { name: title || t('plan.split.title') })}
        message={t('plan.common.deleteMessage')}
        confirmLabel={t('plan.common.delete')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          removeSplit(initial.id)
            .then(() => router.back())
            .catch(() => show({ tone: 'error', title: t('plan.common.deleteFailed') }));
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pair: { flexDirection: 'row', gap: space.md },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addBlock: { gap: space.md, marginTop: space.md, alignItems: 'stretch' },
  item: { gap: space.xs, paddingBottom: space.md, marginBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  checkSpace: { width: 24 },
  gapTop: { marginTop: space.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  actions: { gap: space.sm, marginTop: space.sm },
});
