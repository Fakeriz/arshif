import { Pause, Play } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PopOnMount } from './PopIn';
import { PressableScale } from './PressableScale';

export type VoicePlayerProps = {
  title: string;
  /** Transkrip atau keterangan satu baris. */
  subtitle?: string;
  playing: boolean;
  onToggle: () => void;
  /** Posisi putar 0–1. */
  progress: number;
  durationSec: number;
  bars?: number;
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Pemutar catatan suara: batang gelombang terisi mengikuti posisi putar, ikon putar/jeda berganti dengan letupan. */
export function VoicePlayer({ title, subtitle, playing, onToggle, progress, durationSec, bars = 28 }: VoicePlayerProps) {
  const { colors } = useTheme();
  const t = useT();
  // Bentuk gelombang deterministik: stabil antar-render dan antar-perangkat.
  const heights = useMemo(() => Array.from({ length: bars }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6 + 1))), [bars]);
  const head = Math.max(0, Math.min(1, progress)) * bars;

  return (
    <View style={styles.wrap}>
      <View>
        <AppText variant="bodyStrong">{title}</AppText>
        {subtitle && (
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      <View style={styles.player}>
        <PressableScale accessibilityLabel={playing ? t('common.ui.pause') : t('common.ui.play')} onPress={onToggle} hapticOnPress focusRadius={radius.full} style={[styles.play, { backgroundColor: colors.accent }]}>
          <PopOnMount key={String(playing)}>
            <Icon icon={playing ? Pause : Play} color={colors.onAccent} size={18} />
          </PopOnMount>
        </PressableScale>
        <View style={styles.wave} aria-hidden>
          {heights.map((h, i) => (
            <View key={i} style={[styles.bar, { height: `${h * 100}%`, backgroundColor: i < head ? colors.text : colors.borderStrong }]} />
          ))}
        </View>
        <AppText variant="caption" tone="muted" numeric accessibilityLabel={t('common.ui.timeLeft', { time: clock((1 - progress) * durationSec) })}>
          {clock(progress * durationSec)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  player: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  play: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  wave: { flex: 1, height: 32, flexDirection: 'row', alignItems: 'center', gap: 3 },
  bar: { flex: 1, maxWidth: 4, borderRadius: radius.full },
});
