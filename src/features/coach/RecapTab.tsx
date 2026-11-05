import { Crown } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { usePaywall } from '@/components/shell/Paywall';
import { AppText, Card, CategoryIcon, CurrencyText, EmptyState, GlassView, Icon, PressableScale, ProBadge } from '@/components/ui';
import { shortDate } from '@/lib/dates';
import { categoryLabel, useI18n } from '@/i18n';
import type { WeeklyRecap } from '@/lib/recap';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Weekly Replay (FR-COACH-5): sorotan minggu lalu dengan angka besar dan nada merayakan,
 * bukan tabel angka. Satu kartu satu cerita.
 */
export function RecapTab({ recap, currency }: { recap: WeeklyRecap; currency: string }) {
  const { colors } = useTheme();
  const paywall = usePaywall();
  const { t, lang } = useI18n();
  const range = t('coach.recap.range', { start: shortDate(recap.start, lang), end: shortDate(recap.end, lang) });

  if (recap.txCount === 0) {
    return <EmptyState title={t('coach.recap.emptyTitle')} message={t('coach.recap.emptyMessage')} />;
  }
  const saved = recap.changePct !== null && recap.changePct < 0;

  return (
    <View style={styles.wrap}>
      <AppText variant="overline" tone="secondary">
        {t('coach.recap.replay', { range })}
      </AppText>
      <GlassView radius={radius.lg} style={[styles.hero, { backgroundColor: colors.accentSoft }]}>
        <AppText variant="caption" tone="secondary">
          {t('coach.recap.youSpent')}
        </AppText>
        <CurrencyText amount={recap.spent} currency={currency} variant="amountHero" />
        {recap.changePct !== null && (
          <AppText variant="bodyStrong" tone={saved ? 'positive' : 'secondary'}>
            {saved
              ? t('coach.recap.down', { pct: Math.abs(recap.changePct) })
              : recap.changePct === 0
                ? t('coach.recap.same')
                : t('coach.recap.up', { pct: recap.changePct })}
          </AppText>
        )}
      </GlassView>
      <View style={styles.pair}>
        <Card style={styles.half}>
          <CategoryIcon category={recap.topCategoryKey ?? 'other'} size={44} />
          <AppText variant="caption" tone="secondary">
            {t('coach.recap.topIn')}
          </AppText>
          <AppText variant="h3" numberOfLines={2}>
            {recap.topCategoryKey ? categoryLabel(t, recap.topCategoryKey) : '-'}
          </AppText>
          <CurrencyText amount={recap.topCategorySpent} currency={currency} variant="caption" />
        </Card>
        <Card style={styles.half}>
          <AppText variant="display" numeric>
            {recap.noSpendDays > 0 ? recap.noSpendDays : '7/7'}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {recap.noSpendDays > 0 ? t('coach.recap.noSpendDays') : t('coach.recap.allDaysSpent')}
          </AppText>
          <AppText variant="caption" tone="muted">{t('coach.recap.txInWeek', { count: recap.txCount })}</AppText>
        </Card>
      </View>
      {recap.biggest && (
        <Card>
          <AppText variant="caption" tone="secondary">
            {t('coach.recap.biggest')}
          </AppText>
          <AppText variant="h3">{recap.biggest.merchant}</AppText>
          <CurrencyText amount={recap.biggest.amount} currency={recap.biggest.currency} kind="expense" variant="h2" />
          <AppText variant="caption" tone="muted">
            {shortDate(recap.biggest.date, lang)}
          </AppText>
        </Card>
      )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  flex: { flex: 1 },
  hero: { padding: space.xxl, gap: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1, gap: space.xs },
  locked: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
});
