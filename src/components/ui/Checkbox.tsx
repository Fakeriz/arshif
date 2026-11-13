import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

import { AnimatedCheck, PopIn } from './PopIn';
import { PressableScale } from './PressableScale';

/** Kotak centang 44px untuk area sentuh; visual 24px. */
export function Checkbox({ checked, onChange, accessibilityLabel }: { checked: boolean; onChange: (next: boolean) => void; accessibilityLabel: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="checkbox"
      aria-checked={checked}
      accessibilityLabel={accessibilityLabel}
      onPress={() => onChange(!checked)}
      focusRadius={radius.sm}
      style={styles.hit}
    >
      <View style={[styles.box, { borderColor: checked ? colors.accent : colors.borderStrong }]}>
        {/* Isi tumbuh dari tengah, lalu centang meletup di atasnya. */}
        <PopIn visible={checked} from={0.4} style={[styles.fill, { backgroundColor: colors.accent }]}>
          {null}
        </PopIn>
        <AnimatedCheck visible={checked} color={colors.onAccent} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  box: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFill },
});
