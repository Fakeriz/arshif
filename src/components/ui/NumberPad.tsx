import { Delete } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence } from 'react-native-reanimated';

import { useT } from '@/i18n';
import { pressKey, typedDisplay, typedToMinor, type KeypadKey } from '@/lib/keypad';
import { currencyMeta } from '@/lib/money';
import { haptic, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export type NumberPadProps = {
  onKey: (key: KeypadKey) => void;
  /** Mata uang menentukan tombol kiri bawah: desimal (MYR, USD) atau "000" (IDR, JPY). */
  currency: string;
  disabled?: boolean;
};

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

/**
 * Keypad nominal layar penuh ala aplikasi pembayaran: target sentuh besar, angka tabular,
 * getar halus per ketukan. Tahan tombol hapus untuk mengosongkan.
 */
export function NumberPad({ onKey, currency, disabled }: NumberPadProps) {
  const { colors } = useTheme();
  const t = useT();
  const m = currencyMeta(currency);
  const extra: KeypadKey = m.exponent > 0 ? 'decimal' : '000';

  const press = (key: KeypadKey) => {
    haptic('selection');
    onKey(key);
  };

  const keyLabel = (key: KeypadKey): string => {
    if (key === 'decimal') return m.decimal;
    return key;
  };

  const renderKey = (key: KeypadKey) => {
    const a11y = key === 'decimal' ? t('common.fin.decimal') : key === '000' ? t('common.fin.thousand') : key;
    return (
      <PressableScale
        key={key}
        onPress={() => press(key)}
        disabled={disabled}
        accessibilityLabel={a11y}
        containerStyle={styles.cell}
        style={styles.key}
        focusRadius={radius.lg}
        scaleTo={0.92}
      >
        <AppText variant="h1" numeric>
          {keyLabel(key)}
        </AppText>
      </PressableScale>
    );
  };

  return (
    <View accessibilityLabel={t('common.fin.keypad')} style={styles.grid}>
      {ROWS.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map(renderKey)}
        </View>
      ))}
      <View style={styles.row}>
        {renderKey(extra)}
        {renderKey('0')}
        <PressableScale
          onPress={() => press('back')}
          onLongPress={() => {
            haptic('warning');
            onKey('clear');
          }}
          disabled={disabled}
          accessibilityLabel={t('common.fin.backspace')}
          accessibilityHint={t('common.fin.backspaceHint')}
          containerStyle={styles.cell}
          style={styles.key}
          focusRadius={radius.lg}
          scaleTo={0.92}
        >
          <Icon icon={Delete} color={colors.text} size={26} />
        </PressableScale>
      </View>
    </View>
  );
}

/** State keypad siap pakai: teks ketikan, nilai minor units, dan teks tampilan. */
export function useNumberPad(currency: string, initial = '') {
  const [typed, setTyped] = useState(initial);
  // Bertambah tiap ketukan yang ditolak (digit melewati batas, desimal kedua): pemicu animasi goyang.
  const [rejects, setRejects] = useState(0);
  const onKey = useCallback(
    (key: KeypadKey) =>
      setTyped((prev) => {
        const next = pressKey(prev, key, currency);
        if (next === prev && key !== 'back' && key !== 'clear') setRejects((n) => n + 1);
        return next;
      }),
    [currency],
  );
  return {
    typed,
    setTyped,
    onKey,
    rejects,
    minor: typedToMinor(typed, currency),
    display: typedDisplay(typed, currency),
  };
}

export type NumberPadDisplayProps = {
  /** Teks tampilan dari useNumberPad().display. */
  display: string;
  currency: string;
  /** useNumberPad().rejects: tiap kenaikan menggoyang tampilan + getar peringatan. */
  rejects?: number;
};

/** Nominal besar di atas keypad: "pop" halus tiap ketukan, goyang saat ketukan ditolak. */
export function NumberPadDisplay({ display, currency, rejects = 0 }: NumberPadDisplayProps) {
  const { timing, spring, reduced } = useMotion();
  const m = currencyMeta(currency);
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) return;
    if (reduced) return;
    scale.value = withSequence(timing(1.04, motion.fast / 2), spring(1));
  }, [display, scale, timing, spring, reduced]);

  useEffect(() => {
    if (first.current) return;
    haptic('warning');
    if (reduced) return;
    const d = motion.fast / 3;
    shake.value = withSequence(timing(-8, d), timing(8, d), timing(-5, d), timing(5, d), timing(0, d));
  }, [rejects, shake, timing, reduced]);

  useEffect(() => {
    first.current = false;
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }, { scale: scale.value }] }));

  return (
    <Animated.View style={[styles.display, style]} accessibilityLiveRegion="polite">
      <AppText variant="h2" tone="muted">
        {m.symbol}
      </AppText>
      <AppText variant="balanceHero" numeric numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.displayText}>
        {display}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space.xs },
  row: { flexDirection: 'row', gap: space.xs },
  cell: { flex: 1 },
  display: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: space.sm, paddingVertical: space.md },
  displayText: { flexShrink: 1 },
  key: { height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
});
