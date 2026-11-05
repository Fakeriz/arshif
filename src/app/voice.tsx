import { Mic, Square } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
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
  const t = useT();
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
        <ScreenHeader title={t('capture.voice.title')} />
        <EmptyState kind="limit" title={t('capture.voice.limitTitle')} message={t('capture.voice.limitMessage')} actionLabel={t('capture.seePremium')} onAction={() => paywall(t('capture.voice.limitReason'))} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('capture.voice.title')} />
      {phase === 'processing' ? (
        <View style={styles.center}>
          <ProcessingView title={t('capture.voice.processingTitle')} message={t('capture.voice.processingMessage')} />
        </View>
      ) : phase === 'failed' ? (
        <EmptyState kind="error" title={t('capture.voice.failedTitle')} message={t('capture.voice.failedMessage')} actionLabel={t('capture.voice.rerecord')} onAction={() => setPhase('idle')} />
      ) : (
        <View style={styles.center}>
          <Waveform active={phase === 'recording'} />
          <AppText variant="display" numeric aria-live="polite">
            {clock(seconds)}
          </AppText>
          <AppText variant="caption" tone="muted">{t('capture.voice.max', { time: clock(MAX_SECONDS) })}</AppText>
          <PressableScale
            accessibilityLabel={phase === 'recording' ? t('capture.voice.stop') : t('capture.voice.start')}
            onPress={phase === 'recording' ? stop : start}
            focusRadius={radius.full}
            scaleTo={0.94}
            style={[styles.mic, { backgroundColor: colors.accent }]}
          >
            <Icon icon={phase === 'recording' ? Square : Mic} color={colors.onAccent} size={36} />
          </PressableScale>
          <AppText variant="body" tone="secondary" align="center">
            {phase === 'recording' ? t('capture.voice.recordingHint') : t('capture.voice.idleHint')}
          </AppText>
          {phase === 'idle' && (
            <AppText variant="caption" tone="muted" align="center">
              {t('capture.voice.example')}
            </AppText>
          )}
        </View>
      )}
      <AppText variant="caption" tone="muted" align="center">
        {t('capture.voice.micNote')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space.lg, paddingVertical: space.x3 },
  mic: { width: 96, height: 96, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginVertical: space.md },
});
