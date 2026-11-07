import { Delete } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence } from 'react-native-reanimated';

import { useT } from '@/i18n';
import { evaluate, extraKey, pressKey, typedDisplay, type KeypadKey, type Operator } from '@/lib/keypad';
import { currencyMeta } from '@/lib/money';
import { haptic, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { layout, motion, radius, space } from '@/theme/tokens';

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
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
];

const OP_LABEL: Record<Operator, { glyph: string; a11y: 'divide' | 'multiply' | 'subtract' | 'add' }> = {
  '/': { glyph: '÷', a11y: 'divide' },
  '*': { glyph: '×', a11y: 'multiply' },
  '-': { glyph: '−', a11y: 'subtract' },
  '+': { glyph: '+', a11y: 'add' },
};

/**
 * Keypad kalkulator: tiap tombol berupa kartu. Angka di kartu gelap bergaris tipis, operator di kartu
 * terbalik (terang di tema gelap), "=" kartu lebar penuh. Getar halus per ketukan; tahan hapus untuk mengosongkan.
 */
export function NumberPad({ onKey, currency, disabled }: NumberPadProps) {
  const { colors } = useTheme();
  const t = useT();
  const m = currencyMeta(currency);
  const extra = extraKey(currency);

  const press = (key: KeypadKey) => {
    haptic('selection');
    onKey(key);
  };

  const renderKey = (key: KeypadKey) => {
    const op = OP_LABEL[key as Operator];
    const a11y = op
      ? t(`common.fin.${op.a11y}`)
      : key === 'decimal'
        ? t('common.fin.decimal')
        : key === '000'
          ? t('common.fin.thousand')
          : key;
    return (
      <PressableScale
        key={key}
        onPress={() => press(key)}
        disabled={disabled}
        accessibilityLabel={a11y}
        containerStyle={styles.cell}
        style={[
          styles.key,
          op ? { backgroundColor: colors.text } : { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderWidth: layout.hairline },
        ]}
        focusRadius={radius.md}
        scaleTo={0.94}
      >
        <AppText variant={op ? 'h2' : 'h1'} numeric style={op && { color: colors.bg }}>
          {op ? op.glyph : key === 'decimal' ? m.decimal : key}
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
          style={[styles.key, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, borderWidth: layout.hairline }]}
          focusRadius={radius.md}
          scaleTo={0.94}
        >
          <Icon icon={Delete} color={colors.text} size={26} />
        </PressableScale>
        {renderKey('+')}
      </View>
      <PressableScale
        onPress={() => press('equals')}
        disabled={disabled}
        accessibilityLabel={t('common.fin.equals')}
        style={[styles.key, { backgroundColor: colors.surfaceSunken }]}
        focusRadius={radius.md}
        scaleTo={0.97}
      >
        <AppText variant="h2">=</AppText>
      </PressableScale>
    </View>
  );
}

/** Tombol angka, "000", desimal, dan operator: ketukan yang tidak mengubah teks dianggap ditolak. */
const isEntry = (key: KeypadKey) => key !== 'back' && key !== 'clear' && key !== 'equals';

/** State keypad siap pakai: teks ketikan, nilai minor units, dan teks tampilan. */
export function useNumberPad(currency: string, initial = '') {
  const [typed, setTyped] = useState(initial);
  // Bertambah tiap ketukan yang ditolak (digit melewati batas, desimal kedua): pemicu animasi goyang.
  const [rejects, setRejects] = useState(0);
  const onKey = useCallback(
    (key: KeypadKey) =>
      setTyped((prev) => {
        const next = pressKey(prev, key, currency);
        if (next === prev && isEntry(key)) setRejects((n) => n + 1);
        return next;
      }),
    [currency],
  );
  return {
    typed,
    setTyped,
    onKey,
    rejects,
    minor: evaluate(typed, currency),
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
      <AppText variant="h1" tone="muted">
        {m.symbol}
      </AppText>
      <AppText
        variant="balanceHero"
        tone={display === '0' ? 'muted' : 'primary'}
        numeric
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.4}
        align="right"
        style={styles.displayText}
      >
        {display}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  cell: { flex: 1 },
  // Kartu melebar (bukan persegi) seperti acuan; 48 tetap di atas target sentuh 44.
  key: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  display: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.sm, paddingVertical: space.xl },
  displayText: { flex: 1 },
});
