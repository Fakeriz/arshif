import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * Gradasi radial warna aksen di belakang konten atas layar (PRD Bab 11).
 * Satu glow per layar, statis (tanpa animasi), mengikuti aksen pilihan pengguna.
 * Puncak glow sudah diuji: teks di atasnya tetap >= 4.5:1.
 */
export function AmbientGlow({ height = 460 }: { height?: number }) {
  const { colors, accent } = useTheme();
  const id = `glow-${accent}`;
  return (
    <View pointerEvents="none" style={[styles.wrap, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="0%" rx="80%" ry="100%" fx="50%" fy="0%">
            <Stop offset="0" stopColor={colors.accentGlow} stopOpacity={1} />
            <Stop offset="0.55" stopColor={colors.accentGlow} stopOpacity={0.35} />
            <Stop offset="1" stopColor={colors.accentGlow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0 },
});
