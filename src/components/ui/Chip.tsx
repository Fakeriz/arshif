import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
};

export function Chip({ label, selected, onPress, icon, count, disabled }: ChipProps) {
  const { colors } = useTheme();
  const fg = selected ? colors.onAccent : colors.textMuted;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      aria-checked={!!selected} aria-disabled={!!disabled}
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
      focusRadius={radius.chip}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.accent : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}
    >
      <View style={styles.row}>
        {icon && <Icon icon={icon} color={fg} size={15} />}
        <AppText variant="caption" tone={selected ? 'onAccent' : 'muted'} numberOfLines={1} style={styles.label}>
          {label}
        </AppText>
        {count != null && (
          <View style={[styles.count, { backgroundColor: selected ? 'rgba(255, 255, 255, 0.16)' : colors.fill }]}>
            <AppText variant="overline" tone={selected ? 'onAccent' : 'secondary'} numeric>
              {count}
            </AppText>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.chip,
    borderWidth: layout.hairline,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  label: { fontFamily: fonts.semibold },
  count: {
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    paddingHorizontal: space.xs,
    borderRadius: radius.full,
    alignItems: 'center',
  },
});
