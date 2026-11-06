import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AmountField, AppText, Button, Card, CategoryIcon, useToast } from '@/components/ui';
import { CATEGORIES } from '@/constants/categories';
import type { BudgetRecord } from '@/data/types';
import { FormSheet } from '@/features/planning/kit';
import { categoryLabel, useI18n } from '@/i18n';
import { copyBudget, type BudgetDraft } from '@/lib/budget';
import { shortDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { newId } from '@/lib/uuid';
import { useStore } from '@/state/AppStore';
import { useBudget } from '@/state/derived';
import { space } from '@/theme/tokens';

/** Kategori yang bisa diberi batas: semua kategori pengeluaran yang masuk bucket. */
const LIMITABLE = CATEGORIES.filter((c) => c.bucket !== null);

/**
 * Anggaran periode berjalan (FR-BDG-5). Tanpa anggaran tersimpan: memakai penghasilan bulanan, dengan pilihan
 * "Salin periode lalu" (total + per kategori) atau buat baru dengan saran rata-rata 3 periode.
 */
export function BudgetPlanCard() {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { state, dispatch } = useStore();
  const { mainCurrency } = state;
  const b = useBudget();
  const [open, setOpen] = useState(false);
  const limited = Object.keys(b.categoryLimits).length;

  const copyLast = () => {
    if (!b.lastPeriod) return;
    dispatch({ type: 'budget/save', budget: { id: newId(), periodStart: b.period.start, ...copyBudget(b.lastPeriod) } });
    show({ tone: 'success', title: t('budget.plan.copied', { date: shortDate(b.lastPeriod.periodStart, lang) }) });
  };

  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="h3">{t('budget.plan.title')}</AppText>
          <AppText variant="caption" tone="secondary">
            {b.record ? t('budget.plan.saved', { count: limited }) : t('budget.plan.fromIncome')}
          </AppText>
        </View>
        <AppText variant="h3" numeric>
          {formatMoney(b.total, mainCurrency)}
        </AppText>
      </View>
      {!b.record && (
        <AppText variant="caption" tone="muted" style={styles.note}>
          {b.lastPeriod ? t('budget.plan.lastAvailable', { date: shortDate(b.lastPeriod.periodStart, lang) }) : t('budget.plan.firstTime')}
        </AppText>
      )}
      <View style={styles.actions}>
        {!b.record && b.lastPeriod && <Button label={t('budget.plan.copyLast')} variant="secondary" size="md" onPress={copyLast} />}
        <Button label={b.record ? t('budget.plan.edit') : t('budget.plan.create')} variant={!b.record && b.lastPeriod ? 'ghost' : 'secondary'} size="md" onPress={() => setOpen(true)} />
      </View>
      <BudgetSheet
        key={open ? 'open' : 'closed'}
        visible={open}
        onClose={() => setOpen(false)}
        currency={mainCurrency}
        initial={b.record ? { total: b.record.total, categoryLimits: b.record.categoryLimits } : (b.suggestion ?? { total: b.total, categoryLimits: {} })}
        suggested={!b.record && !!b.suggestion}
        suggestion={b.suggestion}
        last={b.lastPeriod}
        onSave={(draft) => {
          dispatch({ type: 'budget/save', budget: { id: b.record?.id ?? newId(), periodStart: b.period.start, ...draft } });
          setOpen(false);
          show({ tone: 'success', title: t('budget.plan.savedToast') });
        }}
      />
    </Card>
  );
}

function BudgetSheet({ visible, onClose, currency, initial, suggested, suggestion, last, onSave }: {
  visible: boolean; onClose: () => void; currency: string; initial: BudgetDraft; suggested: boolean; suggestion: BudgetDraft | null;
  last: BudgetRecord | null; onSave: (d: BudgetDraft) => void;
}) {
  const { t, lang } = useI18n();
  const [total, setTotal] = useState<number | null>(initial.total || null);
  const [limits, setLimits] = useState<Record<string, number | null>>(initial.categoryLimits);
  const [tried, setTried] = useState(false);
  const totalOk = total !== null && total > 0;
  const apply = (d: BudgetDraft) => {
    setTotal(d.total || null);
    setLimits(d.categoryLimits);
  };

  const submit = () => {
    setTried(true);
    if (!totalOk) return;
    const categoryLimits: Record<string, number> = {};
    for (const [k, v] of Object.entries(limits)) if (v !== null && v !== undefined && v > 0) categoryLimits[k] = v;
    onSave({ total: total!, categoryLimits });
  };

  return (
    <FormSheet visible={visible} onClose={onClose} title={t('budget.plan.sheetTitle')} subtitle={t('budget.plan.sheetSub')} submitLabel={t('budget.plan.save')} saving={false} onSubmit={submit}>
      {suggestion && (
        <View style={styles.suggest}>
          <AppText variant="caption" tone="secondary">
            {suggested ? t('budget.plan.suggestionApplied') : t('budget.plan.suggestion', { amount: formatMoney(suggestion.total, currency) })}
          </AppText>
          {!suggested && <Button label={t('budget.plan.useSuggestion')} variant="secondary" size="sm" onPress={() => apply(suggestion)} />}
        </View>
      )}
      {last && <Button label={t('budget.plan.copyFrom', { date: shortDate(last.periodStart, lang) })} variant="ghost" size="sm" onPress={() => apply(copyBudget(last))} />}
      <AmountField label={`${t('budget.plan.total')} (${currency})`} value={total} onChange={setTotal} currency={currency} error={tried && !totalOk ? t('budget.plan.totalError') : undefined} />
      <AppText variant="caption" tone="muted">
        {t('budget.plan.totalHint')}
      </AppText>
      <AppText variant="bodyStrong" accessibilityRole="header">
        {t('budget.plan.categories')}
      </AppText>
      <AppText variant="caption" tone="muted">
        {t('budget.plan.categoriesHint')}
      </AppText>
      {LIMITABLE.map((c) => (
        <View key={c.key} style={styles.catRow}>
          <CategoryIcon category={c.key} size={32} />
          <View style={styles.flex}>
            <AmountField label={categoryLabel(t, c.key)} value={limits[c.key] ?? null} onChange={(v) => setLimits((l) => ({ ...l, [c.key]: v }))} currency={currency} />
          </View>
        </View>
      ))}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  note: { marginTop: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  suggest: { gap: space.sm },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
