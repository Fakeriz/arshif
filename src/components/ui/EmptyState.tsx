import { CircleAlert, Crown, Inbox, WifiOff, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';

/**
 * Satu komponen untuk semua state "tidak ada konten":
 *  empty  — belum ada data
 *  error  — gagal memuat, dengan tombol coba lagi
 *  limit  — kuota/limit Free tercapai, dengan CTA Premium
 *  offline — tidak ada koneksi
 */
export type EmptyStateKind = 'empty' | 'error' | 'limit' | 'offline';

export type EmptyStateProps = {
  kind?: EmptyStateKind;
  title: string;
  message?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

export function EmptyState({
  kind = 'empty',
  title,
  message,
  icon,
  actionLabel,
  onAction,
  compact,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const look = {
    empty: { icon: Inbox, fg: colors.textSecondary, bg: colors.surfaceRaised },
    error: { icon: CircleAlert, fg: colors.negative, bg: colors.negativeSoft },
    limit: { icon: Crown, fg: colors.accentText, bg: colors.accentSoft },
    offline: { icon: WifiOff, fg: colors.warning, bg: colors.warningSoft },
  }[kind];
  const size = compact ? 56 : 72;

  return (
    <View
      style={[styles.wrap, compact && styles.compact]}
      accessibilityRole={kind === 'error' ? 'alert' : undefined}
    >
      <View style={[styles.halo, { width: size, height: size, backgroundColor: look.bg }]}>
        <Icon icon={icon ?? look.icon} color={look.fg} size={compact ? 26 : 32} />
      </View>
      <View style={styles.text}>
        <AppText variant={compact ? 'bodyStrong' : 'h3'} align="center">
          {title}
        </AppText>
        {message && (
          <AppText variant="body" tone="secondary" align="center">
            {message}
          </AppText>
        )}
      </View>
      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          onPress={onAction}
          size={compact ? 'md' : 'lg'}
          variant={kind === 'error' || kind === 'offline' ? 'secondary' : 'primary'}
          icon={kind === 'limit' ? Crown : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.lg, paddingVertical: space.x4, paddingHorizontal: space.xxl },
  compact: { paddingVertical: space.xxl, gap: space.md },
  halo: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  text: { gap: space.xs + 2, maxWidth: 320 },
});
