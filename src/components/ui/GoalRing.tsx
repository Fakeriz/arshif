import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useI18n } from '@/i18n';
import { ringDash } from '@/lib/chart';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

import { AppText } from './AppText';
import { formatPct } from './TrendBadge';

export type GoalRingProps = {
  /** Rasio tercapai, 0–1 (lebih dari 1 dianggap penuh). */
  value: number;
  /** Nama target untuk pembaca layar, mis. "Dana darurat". */
  label: string;
  size?: number;
  thickness?: number;
  /** Isi tengah kustom. Bawaan: persen tercapai. */
  children?: ReactNode;
};

/**
 * Cincin progres target tabungan. Memakai aksen (bukan semantik budget): target menabung
 * bukan batas belanja, jadi tidak ada makna "bahaya". Penuh berganti hijau + label "Tercapai".
 */
export function GoalRing({ value, label, size = 96, thickness = 8, children }: GoalRingProps) {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const r = (size - thickness) / 2;
  const { circumference, filled } = ringDash(value, r);
  const done = value >= 1;
  const pct = formatPct(t, lang, Math.min(Math.max(value, 0), 1), 0);
  const stroke = done ? colors.positive : colors.accent;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.fin.goal', { label, pct })}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(Math.max(value, 0), 1) * 100) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={thickness} fill="none" />
        {filled > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={stroke}
            strokeWidth={thickness}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            // Mulai dari jam 12, searah jarum jam.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={styles.center}>
        {children ?? (
          <>
            <AppText variant={size >= 88 ? 'h2' : 'bodyStrong'} numeric>
              {pct}
            </AppText>
            {done && size >= 88 && (
              <AppText variant="overline" tone="positive">
                {t('common.fin.goalDone')}
              </AppText>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: space.xxs },
});
