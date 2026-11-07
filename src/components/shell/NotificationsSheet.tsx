import { useRouter } from 'expo-router';
import { Bell, BellRing, CalendarClock, ChartPie, Gauge, PiggyBank, Repeat, Sparkles, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, EmptyState, formatPct, Icon, PressableScale } from '@/components/ui';
import type { NotificationType } from '@/data/types';
import { useI18n, type TFunction } from '@/i18n';
import type { Lang } from '@/i18n/types';
import { dayLabel, shortDate } from '@/lib/dates';
import { toMinor } from '@/lib/assets';
import { formatMoney } from '@/lib/money';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const ICONS: Record<NotificationType, LucideIcon> = {
  weekly_recap: Sparkles,
  budget_alert: ChartPie,
  bill_due: CalendarClock,
  quota_warning: Gauge,
  goal_reached: PiggyBank,
  subscription_renewal: Repeat,
  system: Bell,
  price_alert: BellRing,
};

/** Notifikasi dari server membawa nominal mentah (unit terkecil + mata uang) dan tanggal ISO: format di sini. */
function displayVars(vars: Record<string, string | number> | undefined, lang: Lang, t: TFunction): Record<string, string | number> | undefined {
  if (!vars) return vars;
  const out = { ...vars };
  if (typeof vars.amount === 'number' && typeof vars.currency === 'string') out.amount = formatMoney(vars.amount, vars.currency);
  if (typeof vars.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(vars.date)) out.date = shortDate(vars.date, lang);
  // Alert harga: harga dalam satuan utama (bukan minor) + mata uang kutipan, persen dalam angka persen (0,1 = 0,1%).
  const cur = vars.priceCurrency;
  if (typeof cur === 'string') {
    for (const k of ['price', 'base'] as const) if (typeof vars[k] === 'number') out[k] = formatMoney(toMinor(vars[k], cur), cur);
    if (typeof vars.change === 'number') {
      out.changeAbs = formatPct(t, lang, Math.abs(vars.change) / 100);
      out.change = `${vars.change < 0 ? '-' : '+'}${out.changeAbs}`;
    }
    if (typeof vars.threshold === 'number') out.threshold = formatPct(t, lang, vars.threshold / 100);
  }
  return out;
}

export function NotificationsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { colors } = useTheme();
  const router = useRouter();
  const { t, lang } = useI18n();
  const unread = state.notifications.filter((n) => !n.read).length;

  return (
    <BottomSheet scrollable visible={visible} onClose={onClose} title={t('shell.notifications.title')} subtitle={unread ? t('shell.notifications.unread', { count: unread }) : t('shell.notifications.allRead')}>
      {state.notifications.length === 0 ? (
        <EmptyState compact title={t('shell.notifications.emptyTitle')} message={t('shell.notifications.emptyMessage')} />
      ) : (
        <View style={styles.list}>
          {state.notifications.map((n) => {
            const vars = displayVars(n.vars, lang, t);
            const title = t(n.titleKey, vars);
            const message = t(n.messageKey, vars);
            return (
              <PressableScale
                key={n.id}
                accessibilityLabel={`${title}. ${message}. ${n.read ? t('shell.notifications.stateRead') : t('shell.notifications.stateUnread')}`}
                focusRadius={radius.md}
                scaleTo={0.985}
                onPress={() => {
                  dispatch({ type: 'notif/read', id: n.id });
                  if (n.href) {
                    onClose();
                    router.navigate(n.href);
                  }
                }}
                style={styles.item}
              >
                <View style={[styles.icon, { backgroundColor: n.read ? colors.track : colors.accentSoft }]}>
                  <Icon icon={ICONS[n.type]} color={n.read ? colors.textSecondary : colors.accentText} />
                </View>
                <View style={styles.text}>
                  <AppText variant="bodyStrong">{title}</AppText>
                  <AppText variant="caption" tone="secondary">
                    {message}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {`${dayLabel(n.date, lang)}, ${n.time.replace(':', '.')}`}
                  </AppText>
                </View>
                {!n.read && <View style={[styles.dot, { backgroundColor: colors.accent }]} />}
              </PressableScale>
            );
          })}
          {unread > 0 && <Button label={t('shell.notifications.markAll')} variant="secondary" size="md" fullWidth onPress={() => dispatch({ type: 'notif/readAll' })} />}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm },
  icon: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: space.xxs },
  dot: { width: 8, height: 8, borderRadius: radius.full, marginTop: space.sm },
});
