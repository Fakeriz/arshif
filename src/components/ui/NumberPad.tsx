import { Delete } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { pressKey, typedDisplay, typedToMinor, type KeypadKey } from '@/lib/keypad';
import { currencyMeta } from '@/lib/money';
import { haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

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
  const onKey = useCallback((key: KeypadKey) => setTyped((prev) => pressKey(prev, key, currency)), [currency]);
  return {
    typed,
    setTyped,
    onKey,
    minor: typedToMinor(typed, currency),
    display: typedDisplay(typed, currency),
  };
}

const styles = StyleSheet.create({
  grid: { gap: space.xs },
  row: { flexDirection: 'row', gap: space.xs },
  cell: { flex: 1 },
  key: { height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
});
