import { CircleAlert, Crown, Inbox, WifiOff, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { iconBox, layout, radius, space } from '@/theme/tokens';

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
    empty: { icon: Inbox, fg: colors.textSecondary },
    error: { icon: CircleAlert, fg: colors.negative },
    limit: { icon: Crown, fg: colors.text },
    offline: { icon: WifiOff, fg: colors.warning },
  }[kind];
  const size = 56;

  return (
    <View
      style={[styles.wrap, compact && styles.compact]}
      accessibilityRole={kind === 'error' ? 'alert' : undefined}
    >
      <View style={[styles.halo, { width: size, height: size, backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
        <Icon icon={icon ?? look.icon} color={look.fg} size={iconBox[56].icon} />
      </View>
      <View style={styles.text}>
        <AppText variant="h3" align="center">
          {title}
        </AppText>
        {message && (
          <AppText variant="caption" tone="muted" align="center">
            {message}
          </AppText>
        )}
      </View>
      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          onPress={onAction}
          size="md"
          variant={kind === 'error' || kind === 'offline' ? 'secondary' : 'primary'}
          icon={kind === 'limit' ? Crown : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.sm, paddingVertical: space.x4, paddingHorizontal: space.xl },
  compact: { paddingVertical: space.xxl },
  halo: { borderRadius: radius.full, borderWidth: layout.hairline, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  text: { gap: space.xs, maxWidth: 300, marginBottom: space.sm },
});
