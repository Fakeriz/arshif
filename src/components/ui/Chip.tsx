import { Check, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

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
  const fg = selected ? colors.accentText : colors.textSecondary;
  const leading = selected && !icon ? Check : icon;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      aria-checked={!!selected} aria-disabled={!!disabled}
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
      focusRadius={radius.full}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.accentSoft : colors.track,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}
    >
      <View style={styles.row}>
        {leading && <Icon icon={leading} color={fg} size={layout.iconSize.sm} />}
        <AppText variant="caption" tone={selected ? 'accent' : 'secondary'} numberOfLines={1}>
          {label}
        </AppText>
        {count != null && (
          <View style={[styles.count, { backgroundColor: selected ? colors.accent : colors.track }]}>
            <AppText variant="overline" tone={selected ? 'onAccent' : 'muted'} numeric>
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
    borderRadius: radius.full,
    borderWidth: layout.hairline,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  count: {
    minWidth: 18,
    paddingHorizontal: space.xs,
    borderRadius: radius.full,
    alignItems: 'center',
  },
});
