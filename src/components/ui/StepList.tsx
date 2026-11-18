import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { AnimatedCheck, PopIn } from './PopIn';
import { PressableScale } from './PressableScale';

export type StepListProps = { steps: string[]; /** Jumlah langkah yang sudah selesai. */ done: number; onChange?: (done: number) => void };

/** Daftar langkah berurutan (foto struk → cek jumlah → simpan). Tanda langkah terisi dan dicentang satu per satu. */
export function StepList({ steps, done, onChange }: StepListProps) {
  const { colors } = useTheme();
  const t = useT();
  const finished = done >= steps.length;

  return (
    <View style={styles.wrap}>
      <AppText variant="overline" tone={finished ? 'positive' : 'muted'} aria-live="polite">
        {finished ? t('common.ui.stepsDone') : t('common.ui.stepOf', { n: done + 1, total: steps.length })}
      </AppText>
      {steps.map((label, i) => {
        const on = i < done;
        const row = (
          <View style={styles.row}>
            <View style={[styles.mark, { borderColor: on ? colors.accent : colors.borderStrong }]}>
              <PopIn visible={on} from={0.3} style={[styles.fill, { backgroundColor: colors.accent }]}>
                {null}
              </PopIn>
              <AnimatedCheck visible={on} color={colors.onAccent} size={14} />
            </View>
            <AppText variant="body" tone={on ? 'primary' : 'muted'}>
              {label}
            </AppText>
          </View>
        );
        if (!onChange) {
          return (
            <View key={label} accessible accessibilityRole="checkbox" aria-checked={on} accessibilityLabel={label}>
              {row}
            </View>
          );
        }
        return (
          <PressableScale key={label} accessibilityRole="checkbox" aria-checked={on} accessibilityLabel={label} onPress={() => onChange(on ? i : i + 1)} scaleTo={0.985} focusRadius={radius.sm}>
            {row}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 36 },
  mark: { width: 22, height: 22, borderRadius: radius.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFill },
});
