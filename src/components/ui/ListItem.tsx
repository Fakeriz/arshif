import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Skeleton } from './Skeleton';

export type ListItemProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  /** Teks atau elemen di kanan (mis. <CurrencyText/>). */
  trailing?: ReactNode;
  trailingCaption?: string;
  onPress?: () => void;
  chevron?: boolean;
  divider?: boolean;
  accessibilityLabel?: string;
};

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  trailingCaption,
  onPress,
  chevron,
  divider,
  accessibilityLabel,
}: ListItemProps) {
  const { colors } = useTheme();
  const content = (
    <View style={[styles.row, divider && { borderBottomWidth: layout.hairline, borderBottomColor: colors.border }]}>
      {leading}
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      {(trailing != null || trailingCaption) && (
        <View style={styles.trailing}>
          {typeof trailing === 'string' ? (
            <AppText variant="bodyStrong" numberOfLines={1}>
              {trailing}
            </AppText>
          ) : (
            trailing
          )}
          {trailingCaption && (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {trailingCaption}
            </AppText>
          )}
        </View>
      )}
      {chevron && <Icon icon={ChevronRight} color={colors.textMuted} size={layout.iconSize.md} />}
    </View>
  );

  if (!onPress) return <View accessibilityLabel={accessibilityLabel}>{content}</View>;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel ?? title} focusRadius={radius.md} scaleTo={0.985}>
      {content}
    </PressableScale>
  );
}

/** Baris skeleton dengan proporsi sama seperti ListItem. */
export function ListItemSkeleton({ divider }: { divider?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, divider && { borderBottomWidth: layout.hairline, borderBottomColor: colors.border }]}>
      <Skeleton width={40} height={40} radius={radius.full} />
      <View style={styles.body}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="35%" height={11} />
      </View>
      <Skeleton width={72} height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 64 },
  body: { flex: 1, minWidth: 0, gap: space.xxs },
  trailing: { alignItems: 'flex-end', maxWidth: '45%', gap: space.xxs },
});
