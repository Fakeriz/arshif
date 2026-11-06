import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, Icon, PressableScale } from '@/components/ui';
import type { Bill } from '@/data/planning';
import { CALENDARS } from '@/i18n/calendar';
import { useI18n } from '@/i18n';
import { daysInMonth, parseYMD, shortDate, weekday, ymd } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { dayStatus } from '@/lib/planning/bills';
import { occurrencesInMonth } from '@/lib/planning/schedule';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

type Status = 'paid' | 'overdue' | 'upcoming';
type Entry = { bill: Bill; status: Status };

/**
 * Kalender jatuh tempo sebulan (FR-BILL-4, minggu mulai Senin): tagihan muncul di tanggal jatuhnya. Titik per
 * status + daftar tagihan hari yang dipilih. `filter` mengikuti filter Lunas / Belum lunas di layar Tagihan.
 */
export function BillCalendar({ bills, today, filter, onPressBill }: { bills: Bill[]; today: string; filter?: 'paid' | 'unpaid'; onPressBill: (b: Bill) => void }) {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const now = parseYMD(today);
  const [month, setMonth] = useState({ y: now.y, m: now.m });
  const [selected, setSelected] = useState<string | null>(today);
  const tone: Record<Status, string> = { paid: colors.positive, overdue: colors.negative, upcoming: colors.info };

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const b of bills) {
      for (const d of occurrencesInMonth(b.dueDate, b.frequency, b.anchorDay, month.y, month.m)) {
        const status = dayStatus(b, d, today);
        if (!status || (filter === 'paid' && status !== 'paid') || (filter === 'unpaid' && status === 'paid')) continue;
        map.set(d, [...(map.get(d) ?? []), { bill: b, status }]);
      }
    }
    return map;
  }, [bills, month, today, filter]);

  const total = daysInMonth(month.y, month.m);
  const lead = (weekday(ymd(month.y, month.m, 1)) + 6) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => ymd(month.y, month.m, i + 1))];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => {
    const idx = month.y * 12 + month.m - 1 + n;
    setMonth({ y: Math.floor(idx / 12), m: (idx % 12) + 1 });
    setSelected(null);
  };
  const week = [...CALENDARS[lang].daysShort.slice(1), CALENDARS[lang].daysShort[0]];
  const picked = selected ? (byDay.get(selected) ?? []) : [];
  const statusLabel = (s: Status) => (s === 'paid' ? t('plan.bills.legendPaid') : s === 'overdue' ? t('plan.bills.legendOverdue') : t('plan.bills.legendDue'));

  return (
    <Card padding="md">
      <View style={styles.head}>
        <NavButton label={t('plan.bills.prevMonth')} icon={ChevronLeft} onPress={() => shift(-1)} />
        <AppText variant="bodyStrong" accessibilityRole="header" accessibilityLiveRegion="polite">
          {`${CALENDARS[lang].months[month.m - 1]} ${month.y}`}
        </AppText>
        <NavButton label={t('plan.bills.nextMonth')} icon={ChevronRight} onPress={() => shift(1)} />
      </View>
      <View style={styles.grid}>
        {week.map((d) => (
          <View key={d} style={styles.cell}>
            <AppText variant="caption" tone="muted">
              {d}
            </AppText>
          </View>
        ))}
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={styles.cell} />;
          const entries = byDay.get(d) ?? [];
          const isToday = d === today;
          const isSel = d === selected;
          return (
            <Pressable
              key={d}
              style={styles.cell}
              onPress={() => setSelected(d)}
              accessibilityRole="button"
              aria-selected={isSel}
              accessibilityLabel={entries.length ? t('plan.bills.dayLabel', { date: shortDate(d, lang), names: entries.map((e) => `${e.bill.name} (${statusLabel(e.status)})`).join(', ') }) : shortDate(d, lang)}
            >
              <View style={[styles.day, isSel && { backgroundColor: colors.accentSoft }, isToday && { borderColor: colors.accent, borderWidth: 1 }]}>
                <AppText variant="caption" tone={isSel ? 'accent' : 'primary'} numeric>
                  {String(Number(d.slice(8)))}
                </AppText>
              </View>
              <View style={styles.dots}>
                {entries.slice(0, 3).map((e, j) => (
                  <View key={j} style={[styles.dot, { backgroundColor: tone[e.status] }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        {(filter === 'paid' ? (['paid'] as const) : filter === 'unpaid' ? (['upcoming', 'overdue'] as const) : (['upcoming', 'overdue', 'paid'] as const)).map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: tone[s] }]} />
            <AppText variant="caption" tone="secondary">
              {statusLabel(s)}
            </AppText>
          </View>
        ))}
      </View>
      {selected && picked.length === 0 && (
        <AppText variant="caption" tone="muted" style={styles.none}>
          {t('plan.bills.dayEmpty', { date: shortDate(selected, lang) })}
        </AppText>
      )}
      {byDay.size === 0 && (
        <AppText variant="caption" tone="muted" align="center">
          {filter === 'paid' ? t('plan.bills.monthEmptyPaid') : t('plan.bills.monthEmpty')}
        </AppText>
      )}
      {picked.length > 0 && (
        <View style={[styles.picked, { borderTopColor: colors.border }]}>
          {picked.map((e) => (
            <PressableScale key={e.bill.id} onPress={() => onPressBill(e.bill)} accessibilityLabel={`${e.bill.name}, ${formatMoney(e.bill.amount, e.bill.currency)}, ${statusLabel(e.status)}`} style={styles.pickedRow}>
              <View style={[styles.dot, { backgroundColor: tone[e.status] }]} />
              <AppText variant="body" numberOfLines={1} style={styles.flex}>
                {e.bill.name}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {statusLabel(e.status)}
              </AppText>
              <AppText variant="bodyStrong" numeric>
                {formatMoney(e.bill.amount, e.bill.currency)}
              </AppText>
            </PressableScale>
          ))}
        </View>
      )}
    </Card>
  );
}

function NavButton({ label, icon, onPress }: { label: string; icon: typeof ChevronLeft; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} focusRadius={radius.full} style={styles.nav}>
      <Icon icon={icon} color={colors.textSecondary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: space.xxs, minHeight: 44 },
  day: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 2, height: 6, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  picked: { marginTop: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, gap: space.xs },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  flex: { flex: 1, minWidth: 0 },
  none: { marginTop: space.md },
});
