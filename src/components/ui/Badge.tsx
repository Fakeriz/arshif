import { Crown, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AppText, type TextTone } from './AppText';
import { Icon } from './Icon';

export type BadgeTone = 'neutral' | 'accent' | 'positive' | 'negative' | 'warning' | 'info';

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  icon?: LucideIcon;
};

export function Badge({ label, tone = 'neutral', icon }: BadgeProps) {
  const { colors } = useTheme();
  const looks: Record<BadgeTone, { bg: string; fg: string; text: TextTone }> = {
    neutral: { bg: colors.track, fg: colors.textSecondary, text: 'secondary' },
    accent: { bg: colors.accentSoft, fg: colors.accentText, text: 'accent' },
    positive: { bg: colors.positiveSoft, fg: colors.positive, text: 'positive' },
    negative: { bg: colors.negativeSoft, fg: colors.negative, text: 'negative' },
    warning: { bg: colors.warningSoft, fg: colors.warning, text: 'warning' },
    info: { bg: colors.infoSoft, fg: colors.info, text: 'info' },
  };
  const map = looks[tone];

  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      {icon && <Icon icon={icon} color={map.fg} size={12} />}
      <AppText variant="overline" tone={map.text} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

/** Penanda fitur Premium. Solid kuningan — fungsional, bukan dekorasi. */
export function ProBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel="Fitur Premium"
      style={[
        styles.badge,
        size === 'sm' && styles.sm,
        { backgroundColor: colors.accent },
      ]}
    >
      <Icon icon={Crown} color={colors.onAccent} size={size === 'sm' ? 10 : 12} />
      <AppText variant="overline" tone="onAccent">
        PRO
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.full,
  },
  sm: { paddingHorizontal: space.xs + 2, paddingVertical: space.xxs },
});
