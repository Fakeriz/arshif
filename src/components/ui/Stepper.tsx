import { Minus, Plus } from 'lucide-react-native';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { RollingNumber } from './RollingNumber';

export type StepperProps = {
  value: number;
  onChange: (next: number) => void;
  /** Nama nilai untuk pembaca layar, mis. "Anggota" atau "Anggaran makan". */
  accessibilityLabel: string;
  min?: number;
  max?: number;
  step?: number;
  /** Format tampilan, mis. (n) => formatMoney(n, 'IDR'). */
  format?: (n: number) => string;
  /** lg = nominal besar (amountHero) dengan tombol 44; md = penghitung ringkas. */
  size?: 'md' | 'lg';
};

/** Penambah/pengurang nilai: tombol − dan + mengapit angka yang bergulir searah perubahan. */
export function Stepper({ value, onChange, accessibilityLabel, min = 0, max = Number.MAX_SAFE_INTEGER, step = 1, format = String, size = 'md' }: StepperProps) {
  const { colors } = useTheme();
  const t = useT();
  const prev = useRef(value);
  const direction = value >= prev.current ? 1 : -1;
  prev.current = value;

  const bump = (d: 1 | -1) => {
    const next = Math.min(max, Math.max(min, value + d * step));
    if (next === value) return;
    haptic('selection');
    onChange(next);
  };
  const side = size === 'lg' ? 44 : 36;
  const button = [styles.button, { width: side, height: side, backgroundColor: colors.track }];

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => bump(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={[styles.row, size === 'lg' && styles.spread]}
    >
      <PressableScale accessibilityLabel={t('common.ui.decrease')} disabled={value <= min} onPress={() => bump(-1)} focusRadius={radius.full} hitSlop={6} style={button}>
        <Icon icon={Minus} color={colors.text} size={18} />
      </PressableScale>
      <View style={size === 'md' && styles.mdValue}>
        <RollingNumber value={format(value)} variant={size === 'lg' ? 'amountHero' : 'h1'} direction={direction} />
      </View>
      <PressableScale accessibilityLabel={t('common.ui.increase')} disabled={value >= max} onPress={() => bump(1)} focusRadius={radius.full} hitSlop={6} style={button}>
        <Icon icon={Plus} color={colors.text} size={18} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  spread: { justifyContent: 'space-between', alignSelf: 'stretch' },
  mdValue: { minWidth: 36, alignItems: 'center' },
  button: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
