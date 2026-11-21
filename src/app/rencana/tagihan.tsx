import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GridCell, GridRow } from '@/components/shell/DesktopGrid';
import { AppText, Badge, CategoryIcon, EmptyState, Group, ListCard, ListItem, Tabs } from '@/components/ui';
import type { Bill } from '@/data/planning';
import { BillCalendar } from '@/features/planning/BillCalendar';
import { BillSheet, dueLabel } from '@/features/planning/BillSheet';
import { BillForm } from '@/features/planning/forms';
import { AddButton, PlanScreen } from '@/features/planning/kit';
import { useDesktop } from '@/hooks/useDesktop';
import { useI18n } from '@/i18n';
import { diffDays, shortDate, todayYmd } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { BILL_GROUPS, billGroup, type BillGroup } from '@/lib/planning/bills';
import { useLimits } from '@/state/limits';
import { usePlanning } from '@/state/planning';
import { space } from '@/theme/tokens';

type Filter = 'unpaid' | 'paid';
type View_ = 'list' | 'calendar';

export default function BillsScreen() {
  const { t, lang } = useI18n();
  const { bills } = usePlanning();
  const limits = useLimits();
  const [filter, setFilter] = useState<Filter>('unpaid');
  const [view, setView] = useState<View_>('list');
  const [form, setForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const today = todayYmd();
  const open = bills.find((b) => b.id === openId) ?? null;
  const desktop = useDesktop();

  const grouped = new Map<BillGroup, Bill[]>();
  for (const b of bills) {
    const g = billGroup(b, today);
    if ((filter === 'paid') !== (g === 'paid')) continue;
    grouped.set(g, [...(grouped.get(g) ?? []), b]);
  }
  const groups = BILL_GROUPS.filter((g) => grouped.has(g));

  const filterTabs = (
    <Tabs
      accessibilityLabel={t('plan.bills.title')}
      value={filter}
      onChange={setFilter}
      items={[
        { key: 'unpaid', label: t('plan.bills.filter.unpaid') },
        { key: 'paid', label: t('plan.bills.filter.paid') },
      ]}
    />
  );
  const calendar = <BillCalendar bills={bills} today={today} filter={filter} onPressBill={(b) => setOpenId(b.id)} />;
  const billList =
    groups.length === 0 ? (
      <EmptyState compact title={filter === 'unpaid' ? t('plan.bills.emptyUnpaid') : t('plan.bills.emptyPaid')} />
    ) : (
      <>
        {groups.map((g) => (
          <Group key={g} label={t(`plan.bills.group.${g}`)}>
            <ListCard>
              {grouped.get(g)!.map((b, i, list) => {
                const days = diffDays(b.dueDate, today);
                return (
                  <ListItem
                    key={b.id}
                    leading={<CategoryIcon category={b.categoryKey} size={40} />}
                    title={b.name}
                    subtitle={
                      g === 'paid'
                        ? t('plan.bills.nextDue', { date: shortDate(b.dueDate, lang) })
                        : `${days < 0 ? t('plan.bills.dueIn', { date: shortDate(b.dueDate, lang) }) : dueLabel(t, lang, days, b.dueDate)} · ${t(`plan.bills.freq.${b.frequency}`)}`
                    }
                    trailing={
                      <View style={styles.trailing}>
                        <AppText variant="bodyStrong" numeric>
                          {formatMoney(b.amount, b.currency)}
                        </AppText>
                        {days < 0 && <Badge label={t('plan.bills.overdueBadge', { days: -days })} tone="negative" />}
                      </View>
                    }
                    onPress={() => setOpenId(b.id)}
                    divider={i < list.length - 1}
                  />
                );
              })}
            </ListCard>
          </Group>
        ))}
      </>
    );

  return (
    <PlanScreen
      wide={desktop}
      title={t('plan.bills.title')}
      right={bills.length ? <AddButton label={t('plan.common.add')} limited={limits.billsDebts} reason={t('plan.bills.limitReason')} onPress={() => setForm(true)} /> : undefined}
    >
      {bills.length === 0 ? (
        <EmptyState title={t('plan.bills.emptyTitle')} message={t('plan.bills.emptyMessage')} actionLabel={t('plan.bills.create')} onAction={() => setForm(true)} />
      ) : (
        <>
          {desktop ? (
            // Desktop: daftar dan kalender tampil berdampingan, tanpa perlu berpindah tampilan.
            <GridRow style={styles.top}>
              <GridCell span={7}>
                {filterTabs}
                {billList}
              </GridCell>
              <GridCell span={5} order={1}>
                {calendar}
              </GridCell>
            </GridRow>
          ) : (
            <>
              <Tabs
                accessibilityLabel={t('plan.bills.viewLabel')}
                value={view}
                onChange={setView}
                items={[
                  { key: 'list', label: t('plan.bills.view.list') },
                  { key: 'calendar', label: t('plan.bills.view.calendar') },
                ]}
              />
              {filterTabs}
              {view === 'calendar' ? calendar : billList}
            </>
          )}
        </>
      )}
      <BillForm key={form ? 'open' : 'closed'} visible={form} onClose={() => setForm(false)} />
      <BillSheet bill={open} onClose={() => setOpenId(null)} />
    </PlanScreen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'flex-start' },
  trailing: { alignItems: 'flex-end', gap: space.xxs },
});
