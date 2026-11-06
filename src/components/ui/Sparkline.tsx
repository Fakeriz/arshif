import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useI18n } from '@/i18n';
import { areaUnder, linePoints, smoothPath } from '@/lib/chart';
import { useTheme } from '@/theme/ThemeProvider';
import { chartArea } from '@/theme/tokens';

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
              <Path d={areaUnder(line, pts, height)} fill={`url(#${gradId})`} />
            </>
          )}
          <Path d={line} stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {endDot && (
            <Circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3} fill={stroke} stroke={colors.surface} strokeWidth={1.5} />
          )}
        </Svg>
      )}
    </View>
  );
}
