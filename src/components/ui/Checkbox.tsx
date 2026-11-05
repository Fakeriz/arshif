import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

import { Icon } from './Icon';
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
      <View style={[styles.box, { backgroundColor: checked ? colors.accent : 'transparent', borderColor: checked ? colors.accent : colors.borderStrong }]}>
        {checked && <Icon icon={Check} color={colors.onAccent} size={16} />}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  box: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
