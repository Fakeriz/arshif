import { CalendarCheck, Crown, HandCoins, PiggyBank, TrendingDown, Trophy, Utensils, type LucideIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePaywall } from '@/components/shell/Paywall';
import { AppText, Card, CategoryIcon, CurrencyText, EmptyState, GlassView, Icon, PressableScale, ProBadge, Tabs } from '@/components/ui';
import type { Transaction } from '@/data/types';
import { categoryLabel, useI18n } from '@/i18n';
import { shortDate, todayYmd } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { monthlyRecap, weeklyRecap, type Achievement, type WeeklyRecap } from '@/lib/recap';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const ACHIEVEMENT_ICON: Record<Achievement, LucideIcon> = {
  noSpend: CalendarCheck,
  spentLess: TrendingDown,
  saved: PiggyBank,
  debtPaid: HandCoins,
  cooked: Utensils,
};

/**
 * Weekly Replay (FR-COACH-5): recap minggu dengan nada merayakan. Satu kartu satu cerita: angka besar di depan,
 * lalu sorotan (belanja terbesar, hemat terbesar) dan pencapaian. Bawaan minggu berjalan; minggu lalu satu ketuk.
 * Bulan lalu = recap bulanan (Premium); paket Free melihat ajakan Premium di tab itu.
 */
export function RecapTab({ transactions, currency }: { transactions: Transaction[]; currency: string }) {
  const { t } = useI18n();
  const { state } = useStore();
  const premium = state.plan === 'premium';
  const [week, setWeek] = useState<'this' | 'last' | 'month'>('this');
  const today = todayYmd();
  const recaps = useMemo(
    () => ({
      this: weeklyRecap(transactions, today, currency, 'this'),
      last: weeklyRecap(transactions, today, currency, 'last'),
      month: monthlyRecap(transactions, today, currency),
    }),
    [transactions, today, currency],
  );
  const recap = recaps[week];

  let body;
  if (week === 'month' && !premium) body = <MonthlyTeaser />;
  else if (recap.txCount === 0) {
    body =
      week === 'month' ? (
        <EmptyState title={t('coach.replay.emptyMonthTitle')} message={t('coach.replay.emptyMonthMessage')} />
      ) : (
        <EmptyState
          title={week === 'this' ? t('coach.replay.emptyThisTitle') : t('coach.recap.emptyTitle')}
          message={week === 'this' ? t('coach.replay.emptyThisMessage') : t('coach.recap.emptyMessage')}
          actionLabel={week === 'this' && recaps.last.txCount > 0 ? t('coach.replay.seeLast') : undefined}
          onAction={week === 'this' && recaps.last.txCount > 0 ? () => setWeek('last') : undefined}
        />
      );
  } else body = <Replay recap={recap} currency={currency} />;

  return (
    <View style={styles.wrap}>
      <Tabs
        accessibilityLabel={t('coach.replay.weekLabel')}
        value={week}
        onChange={setWeek}
        items={[
          { key: 'this', label: t('coach.replay.thisWeek') },
          { key: 'last', label: t('coach.replay.lastWeek') },
          { key: 'month', label: t('coach.replay.lastMonth') },
        ]}
      />
      {body}
    </View>
  );
}

function Replay({ recap, currency }: { recap: WeeklyRecap; currency: string }) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const range = t('coach.recap.range', { start: shortDate(recap.start, lang), end: shortDate(recap.end, lang) });
  const down = recap.changePct !== null && recap.changePct < 0;

  return (
    <>
      <GlassView radius={radius.lg} style={[styles.hero, { backgroundColor: colors.accentSoft }]}>
        <AppText variant="overline" tone="secondary">
          {recap.week === 'month' ? t('coach.replay.monthRange', { range }) : t('coach.recap.replay', { range })}
        </AppText>
        <AppText variant="bodyStrong">
          {recap.week === 'this' ? t('coach.replay.heroThis', { days: recap.days }) : recap.week === 'month' ? t('coach.replay.heroMonth') : t('coach.recap.youSpent')}
        </AppText>
        <CurrencyText amount={recap.spent} currency={currency} variant="amountHero" />
        {recap.changePct !== null && (
          <AppText variant="bodyStrong" tone={down ? 'positive' : 'secondary'}>
            {down
              ? t(recap.week === 'month' ? 'coach.replay.monthDown' : 'coach.recap.down', { pct: Math.abs(recap.changePct) })
              : recap.changePct === 0
                ? t(recap.week === 'month' ? 'coach.replay.monthSame' : 'coach.recap.same')
                : t(recap.week === 'month' ? 'coach.replay.monthUp' : 'coach.recap.up', { pct: recap.changePct })}
          </AppText>
        )}
        {recap.week === 'this' && recap.changePct !== null && (
          <AppText variant="caption" tone="muted">
            {t('coach.replay.fairCompare')}
          </AppText>
        )}
      </GlassView>

      {recap.achievements.length > 0 && (
        <Card>
          <View style={styles.titleRow}>
            <Icon icon={Trophy} color={colors.accentText} />
            <AppText variant="h3">{t(recap.week === 'month' ? 'coach.replay.achievementsMonth' : 'coach.replay.achievements', { count: recap.achievements.length })}</AppText>
          </View>
          <View style={styles.list}>
            {recap.achievements.map((a) => (
              <View key={a} style={styles.achievement}>
                <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
                  <Icon icon={ACHIEVEMENT_ICON[a]} color={colors.accentText} size={20} />
                </View>
                <AppText variant="body" style={styles.flex}>
                  {achievementText(a, recap, currency, t)}
                </AppText>
              </View>
            ))}
          </View>
        </Card>
      )}

      <View style={styles.pair}>
        {recap.biggest && (
          <Card style={styles.half}>
            <AppText variant="caption" tone="secondary">
              {t('coach.recap.biggest')}
            </AppText>
            <AppText variant="h3" numberOfLines={2}>
              {recap.biggest.merchant || categoryLabel(t, recap.biggest.categoryKey)}
            </AppText>
            <CurrencyText amount={recap.biggest.amount} currency={recap.biggest.currency} kind="expense" variant="bodyStrong" />
            <AppText variant="caption" tone="muted">
              {shortDate(recap.biggest.date, lang)}
            </AppText>
          </Card>
        )}
        <Card style={styles.half}>
          <AppText variant="caption" tone="secondary">
            {t('coach.replay.biggestSaving')}
          </AppText>
          {recap.biggestSaving ? (
            <>
              <CategoryIcon category={recap.biggestSaving.categoryKey} size={36} />
              <AppText variant="h3" numberOfLines={2}>
                {categoryLabel(t, recap.biggestSaving.categoryKey)}
              </AppText>
              <AppText variant="caption" tone="positive">
                {t(recap.week === 'month' ? 'coach.replay.savedVsLastMonth' : 'coach.replay.savedVsLast', { amount: formatMoney(recap.biggestSaving.saved, currency) })}
              </AppText>
            </>
          ) : (
            <AppText variant="caption" tone="muted">
              {t('coach.replay.noSaving')}
            </AppText>
          )}
        </Card>
      </View>

      <Card>
        <View style={styles.statRow}>
          <View style={styles.flex}>
            <AppText variant="caption" tone="secondary">
              {t('coach.recap.topIn')}
            </AppText>
            <AppText variant="h3" numberOfLines={1}>
              {recap.topCategoryKey ? categoryLabel(t, recap.topCategoryKey) : '-'}
            </AppText>
            <CurrencyText amount={recap.topCategorySpent} currency={currency} variant="caption" />
          </View>
          <View style={styles.stat}>
            <AppText variant="display" numeric>
              {String(recap.noSpendDays)}
            </AppText>
            <AppText variant="caption" tone="secondary" align="center">
              {t('coach.replay.noSpendOf', { days: recap.days })}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" tone="muted">
          {t(recap.week === 'month' ? 'coach.replay.txInMonth' : 'coach.recap.txInWeek', { count: recap.txCount })}
        </AppText>
      </Card>
    </>
  );
}

function achievementText(a: Achievement, r: WeeklyRecap, currency: string, t: ReturnType<typeof useI18n>['t']): string {
  switch (a) {
    case 'noSpend':
      return t('coach.replay.achievement.noSpend', { count: r.noSpendDays });
    case 'spentLess':
      return t(r.week === 'month' ? 'coach.replay.achievement.spentLessMonth' : 'coach.replay.achievement.spentLess', { pct: Math.abs(r.changePct ?? 0) });
    case 'saved':
      return t('coach.replay.achievement.saved', { amount: formatMoney(r.savedAmount, currency) });
    case 'debtPaid':
      return t('coach.replay.achievement.debtPaid', { amount: formatMoney(r.debtPaid, currency) });
    case 'cooked':
      return t(r.week === 'month' ? 'coach.replay.achievement.cookedMonth' : 'coach.replay.achievement.cooked');
  }
}

function MonthlyTeaser() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const paywall = usePaywall();
  return (
    <PressableScale accessibilityLabel={t('coach.recap.monthlyA11y')} onPress={() => paywall(t('coach.recap.monthlyReason'))} focusRadius={radius.lg}>
      <GlassView radius={radius.lg} style={styles.locked}>
        <Icon icon={Crown} color={colors.accentText} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{t('coach.recap.monthly')}</AppText>
          <AppText variant="caption" tone="secondary">
            {t('coach.recap.monthlySub')}
          </AppText>
        </View>
        <ProBadge size="sm" />
      </GlassView>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  flex: { flex: 1 },
  hero: { padding: space.xxl, gap: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  list: { gap: space.md, marginTop: space.md },
  achievement: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1, gap: space.xs },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.sm },
  stat: { alignItems: 'center', minWidth: 88 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
});
