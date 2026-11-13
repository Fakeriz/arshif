import { StyleSheet, View } from 'react-native';

import { haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { PopIn } from './PopIn';
import { PressableScale } from './PressableScale';

export type RadioItem<K extends string> = { key: K; label: string; hint?: string };
export type RadioListProps<K extends string> = { items: RadioItem<K>[]; value: K; onChange: (key: K) => void; accessibilityLabel: string };

/** Pilihan tunggal berbaris: sorotan baris memudar masuk, titik radio meletup. */
export function RadioList<K extends string>({ items, value, onChange, accessibilityLabel }: RadioListProps<K>) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.list}>
      {items.map((item) => {
        const on = item.key === value;
        return (
          <PressableScale
            key={item.key}
            accessibilityRole="radio"
            aria-checked={on}
            accessibilityLabel={item.hint ? `${item.label}, ${item.hint}` : item.label}
            onPress={() => {
              if (on) return;
              haptic('selection');
              onChange(item.key);
            }}
            scaleTo={0.985}
            focusRadius={radius.inset}
            style={[styles.row, { backgroundColor: colors.surfaceSunken, borderColor: on ? colors.accent : colors.border }]}
          >
            <PopIn visible={on} from={1} style={[styles.highlight, { backgroundColor: colors.accentSoft }]}>
              {null}
            </PopIn>
            <View style={[styles.mark, { borderColor: on ? colors.accent : colors.borderStrong }]}>
              <PopIn visible={on} from={0} style={[styles.dot, { backgroundColor: colors.accent }]}>
                {null}
              </PopIn>
            </View>
            <AppText variant="bodyStrong">{item.label}</AppText>
            {item.hint && (
              <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.hint}>
                {item.hint}
              </AppText>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.inset, borderWidth: layout.hairline, overflow: 'hidden' },
  highlight: { ...StyleSheet.absoluteFill },
  mark: { width: 20, height: 20, borderRadius: radius.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: radius.full },
  hint: { flex: 1, textAlign: 'right' },
});
