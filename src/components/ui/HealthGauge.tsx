import { TrendingDown, TrendingUp } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useT } from '@/i18n';
import { healthBand, semicircleArc } from '@/lib/chart';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { Skeleton } from './Skeleton';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type HealthGaugeProps = {
  /** Skor 0–100 dari rumus deterministik; null = data belum cukup. */
  score: number | null;
  /** Selisih dari periode sebelumnya. */
  delta?: number;
  size?: number;
  loading?: boolean;
};

export function HealthGauge({ score, delta, size = 240, loading }: HealthGaugeProps) {
  const { colors } = useTheme();
  const t = useT();
  const { timing } = useMotion();
  const stroke = Math.round(size * 0.075);
  const r = size / 2 - stroke / 2;
  const cx = size / 2;
  const cy = size / 2;
  const height = size / 2 + stroke / 2;
  const length = Math.PI * r;
  const value = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = timing(value, motion.slow * 3);
  }, [progress, timing, value]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.value) }));

  if (loading) {
    return (
      <View style={[styles.wrap, { width: size }]}>
        <Skeleton width={size} height={height} radius={size / 2} />
      </View>
    );
  }

  const band = score == null ? null : healthBand(score);
  const bandLabel = band ? t(`domain.healthBand.${band.key}`) : '';
  const toneColor = band
    ? { accent: colors.accent, positive: colors.positive, warning: colors.warning, negative: colors.negative }[band.tone]
    : colors.track;

  return (
    <View
      style={[styles.wrap, { width: size }]}
      accessibilityRole="progressbar"
      accessibilityLabel={score == null ? t('common.health.a11yNone') : t('common.health.a11y', { score: Math.round(score), band: bandLabel })}
    >
      <Svg width={size} height={height}>
        <Path d={semicircleArc(cx, cy, r)} stroke={colors.track} strokeWidth={stroke} strokeLinecap="round" fill="none" />
        {score != null && (
          <AnimatedPath
            d={semicircleArc(cx, cy, r)}
            stroke={toneColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${length} ${length}`}
            animatedProps={animatedProps}
          />
        )}
      </Svg>
      <View style={[styles.center, { top: size * 0.2 }]} pointerEvents="none">
        <AppText variant="display" numeric style={{ fontSize: size * 0.22, lineHeight: size * 0.26 }}>
          {score == null ? '–' : Math.round(score)}
        </AppText>
        <AppText variant="caption" tone="muted">
          {score == null ? t('common.health.needsData') : t('common.health.outOf', { band: bandLabel })}
        </AppText>
      </View>
      {delta != null && score != null && delta !== 0 && (
        <View style={styles.delta}>
          <Icon icon={delta > 0 ? TrendingUp : TrendingDown} color={delta > 0 ? colors.positive : colors.negative} size={16} />
          <AppText variant="caption" tone={delta > 0 ? 'positive' : 'negative'}>
            {t(delta > 0 ? 'common.health.up' : 'common.health.down', { n: Math.abs(delta) })}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'center' },
  center: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  delta: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.md },
});
