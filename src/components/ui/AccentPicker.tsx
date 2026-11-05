import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { ACCENT_OPTIONS, accents, layout, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

/** Pemilih warna aksen (FR-SET-4). Grup radio: satu terpilih, langsung diterapkan ke seluruh tema. */
export function AccentPicker() {
  const { accent, setAccent, scheme, colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Warna aksen" style={styles.row}>
      {ACCENT_OPTIONS.map((o) => {
        const tokens = accents[o.key][scheme];
        const selected = o.key === accent;
        return (
          <PressableScale
            key={o.key}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityLabel={o.label}
            onPress={() => setAccent(o.key)}
            containerStyle={styles.slot}
            focusRadius={radius.md}
            style={styles.item}
          >
            <View
              style={[
                styles.swatch,
                { backgroundColor: tokens.accent, borderColor: selected ? colors.text : colors.glassBorder },
                selected && styles.swatchSelected,
              ]}
            >
              {selected && <Icon icon={Check} color={tokens.onAccent} size={layout.iconSize.md} />}
            </View>
            <AppText variant="caption" tone={selected ? 'primary' : 'secondary'} numberOfLines={1}>
              {o.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xs },
  slot: { flex: 1 },
  item: { alignItems: 'center', gap: space.xs + 2, paddingVertical: space.xs },
  swatch: { width: 44, height: 44, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  swatchSelected: { borderWidth: 2 },
});
