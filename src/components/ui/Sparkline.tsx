import { useEffect, useId } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withDelay } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useI18n } from '@/i18n';
import { areaUnder, linePoints, polylineLength, smoothPath } from '@/lib/chart';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { chartArea, motion } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type SparklineTone = 'auto' | 'neutral' | 'positive' | 'negative' | 'accent';

export type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  /** auto: warna dari arah awal → akhir (naik hijau, turun merah; dibalik bila `invert`). */
  tone?: SparklineTone;
  invert?: boolean;
  /** Isian gradasi di bawah garis. */
  area?: boolean;
  /** Titik di nilai terakhir. */
  endDot?: boolean;
  strokeWidth?: number;
  /** Format nilai untuk label pembaca layar (mis. nominal). Bawaan: angka apa adanya. */
  formatValue?: (v: number) => string;
};

/** Grafik garis mini tanpa sumbu: tren cepat di kartu statistik, baris aset, atau kurs. */
export function Sparkline({
  values,
  width = 96,
  height = 32,
  tone = 'auto',
  invert,
  area = true,
  endDot = true,
  strokeWidth = 1.75,
  formatValue = String,
}: SparklineProps) {
  const { colors, scheme } = useTheme();
  const { t } = useI18n();
  const { timing, reduced } = useMotion();
  // useId bisa berisi ":" yang merusak url(#id) di web.
  const gradId = `spark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const resolved: Exclude<SparklineTone, 'auto'> =
    tone !== 'auto' ? tone : last === first ? 'neutral' : (last > first) !== !!invert ? 'positive' : 'negative';
  const stroke = {
    neutral: chartArea[scheme].line,
    positive: colors.positive,
    negative: colors.negative,
    accent: colors.accentText,
  }[resolved];

  // Ruang tepi agar garis dan titik akhir tidak terpotong.
  const inset = endDot ? 4 : strokeWidth;
  const pts = linePoints(values, width - inset * 2, height, inset).map((p) => ({ x: p.x + inset, y: p.y }));
  const line = smoothPath(pts);
  // Kurva sedikit lebih panjang dari poligonnya; lebihkan agar ujung garis tidak terpotong saat animasi.
  const length = polylineLength(pts) * 1.15 + 4;

  // Garis "tergambar" kiri → kanan, lalu isian dan titik akhir muncul. Diputar ulang saat data berubah.
  const draw = useSharedValue(reduced ? 1 : 0);
  const reveal = useSharedValue(reduced ? 1 : 0);
  const key = values.join(',');
  useEffect(() => {
    draw.value = 0;
    reveal.value = 0;
    draw.value = timing(1, motion.slow * 2);
    reveal.value = withDelay(reduced ? 0 : motion.slow, timing(1, motion.base));
  }, [key, draw, reveal, timing, reduced]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }));
  const areaProps = useAnimatedProps(() => ({ fillOpacity: reveal.value }));
  const dotProps = useAnimatedProps(() => ({ r: 3 * reveal.value, opacity: reveal.value }));

  const label =
    values.length > 1
      ? t('common.fin.sparkline', { count: values.length, from: formatValue(first), to: formatValue(last) })
      : undefined;

  return (
    <View accessible={!!label} accessibilityRole="image" accessibilityLabel={label} style={{ width, height }}>
      {pts.length > 1 && (
        <Svg width={width} height={height}>
          {area && (
            <>
              <Defs>
                <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={stroke} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <AnimatedPath d={areaUnder(line, pts, height)} fill={`url(#${gradId})`} animatedProps={areaProps} />
            </>
          )}
          <AnimatedPath
            d={line}
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${length} ${length}`}
            animatedProps={lineProps}
          />
          {endDot && (
            <AnimatedCircle
              cx={pts[pts.length - 1].x}
              cy={pts[pts.length - 1].y}
              fill={stroke}
              stroke={colors.surface}
              strokeWidth={1.5}
              animatedProps={dotProps}
            />
          )}
        </Svg>
      )}
    </View>
  );
}
