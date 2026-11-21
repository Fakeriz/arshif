import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { parseCover, type CoverPreset } from '@/lib/cover';
import { useTheme } from '@/theme/ThemeProvider';
import { inkCard } from '@/theme/tokens';

import { useSignedUrl } from './ProfileAvatar';

// Pola digambar di kanvas 300x100 (rasio sampul 3:1) lalu di-"slice" ke ukuran sebenarnya.
const LINES = Array.from({ length: 28 }, (_, i) => i * 14);
const RINGS = Array.from({ length: 12 }, (_, i) => 24 + i * 22);

/**
 * Sampul profil. Preset memakai warna kartu tinta (ikut terbalik di tema gelap) supaya tetap satu titik paling kontras
 * di layar; garis tipis memakai warna track tinta (dekoratif, tanpa teks di atasnya). Foto gagal dimuat = preset bawaan.
 */
export function ProfileCover({ value, uri, preset }: { value?: string | null; uri?: string | null; preset?: CoverPreset }) {
  const { scheme, colors } = useTheme();
  const ink = inkCard[scheme];
  const cover = preset ? ({ kind: 'preset', key: preset } as const) : parseCover(value ?? null);
  const remote = useSignedUrl(cover.kind === 'photo' ? cover.path : null);
  const [failed, setFailed] = useState<string | null>(null);
  const src = uri ?? remote;

  if (src && failed !== src) {
    return <Image source={{ uri: src }} style={styles.fill} contentFit="cover" accessible={false} onError={() => setFailed(src)} transition={150} />;
  }
  const key = cover.kind === 'preset' ? cover.key : 'tinta';
  const bg = key === 'batu' ? colors.textSecondary : ink.bg;
  return (
    <View style={[styles.fill, { backgroundColor: bg }]} accessible={false}>
      {key === 'garis' || key === 'lingkar' ? (
        <Svg width="100%" height="100%" viewBox="0 0 300 100" preserveAspectRatio="xMidYMid slice">
          {key === 'garis'
            ? LINES.map((x) => <Line key={x} x1={x} y1={0} x2={x - 100} y2={100} stroke={ink.track} strokeWidth={1} />)
            : RINGS.map((r) => <Circle key={r} cx={270} cy={100} r={r} stroke={ink.track} strokeWidth={1} fill="none" />)}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
});
