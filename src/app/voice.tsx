import { Mic, Square } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePaywall } from '@/components/shell/Paywall';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, EmptyState, Icon, PressableScale } from '@/components/ui';
import { ProcessingView } from '@/features/capture/ProcessingView';
import { Waveform } from '@/features/capture/Waveform';
import { useDemoState } from '@/state/demo';
import { useLimits } from '@/state/limits';
import { haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const MAX_SECONDS = 60;
type Phase = 'idle' | 'recording' | 'processing' | 'failed';

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function VoiceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const demo = useDemoState();
  const limits = useLimits();
  const paywall = usePaywall();
  const [phase, setPhase] = useState<Phase>(demo === 'loading' ? 'processing' : 'idle');
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const done = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) clearInterval(timer.current);
    if (done.current) clearTimeout(done.current);
  };
  useEffect(() => clear, []);

  const stop = () => {
    clear();
    setPhase('processing');
    if (demo === 'loading') return;
    done.current = setTimeout(() => {
      if (demo === 'error') setPhase('failed');
      else router.replace('/voice-review');
    }, 1400);
  };

  useEffect(() => {
    if (seconds >= MAX_SECONDS && phase === 'recording') stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, phase]);

  const start = () => {
    haptic('tap');
    setSeconds(0);
    setPhase('recording');
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  if (limits.automation) {
    return (
      <Screen>
        <ScreenHeader title="Voice Log" />
        <EmptyState kind="limit" title="Kuota automation bulan ini habis" message="Voice Log memakai kuota automation (30/bulan di Free). Reset tanggal 1, atau upgrade untuk tanpa batas." actionLabel="Lihat Premium" onAction={() => paywall('Kuota automation Free (30/bulan, termasuk Voice Log) sudah habis.')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Voice Log" />
      {phase === 'processing' ? (
        <View style={styles.center}>
          <ProcessingView title="Memahami ucapanmu" message="AI mengubah suara jadi transaksi. Kalau gagal, kuota tidak terpotong." />
        </View>
      ) : phase === 'failed' ? (
        <EmptyState kind="error" title="Suara kurang jelas" message="Kuota tidak terpotong. Coba ulangi di tempat yang lebih tenang dan sebut nominalnya dengan jelas." actionLabel="Rekam ulang" onAction={() => setPhase('idle')} />
      ) : (
        <View style={styles.center}>
          <Waveform active={phase === 'recording'} />
          <AppText variant="display" numeric aria-live="polite">
            {clock(seconds)}
          </AppText>
          <AppText variant="caption" tone="muted">{`Maksimal ${clock(MAX_SECONDS)}`}</AppText>
          <PressableScale
            accessibilityLabel={phase === 'recording' ? 'Selesai merekam' : 'Mulai merekam'}
            onPress={phase === 'recording' ? stop : start}
            focusRadius={radius.full}
            scaleTo={0.94}
            style={[styles.mic, { backgroundColor: colors.accent }]}
          >
            <Icon icon={phase === 'recording' ? Square : Mic} color={colors.onAccent} size={36} />
          </PressableScale>
          <AppText variant="body" tone="secondary" align="center">
            {phase === 'recording' ? 'Ketuk lagi kalau sudah selesai bicara.' : 'Ketuk lalu bicara. Bisa beberapa transaksi sekaligus.'}
          </AppText>
          {phase === 'idle' && (
            <AppText variant="caption" tone="muted" align="center">
              {'Contoh: “Tadi makan siang 45 ribu pakai GoPay, terus isi bensin 150 ribu cash.”'}
            </AppText>
          )}
        </View>
      )}
      <AppText variant="caption" tone="muted" align="center">
        Perekaman suara aktif di build native (Fase 2). Di sini hasilnya contoh.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space.lg, paddingVertical: space.x3 },
  mic: { width: 96, height: 96, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginVertical: space.md },
});
