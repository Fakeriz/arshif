import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Mic, Square } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePaywall } from '@/components/shell/Paywall';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, EmptyState, Icon, PressableScale } from '@/components/ui';
import { invokeFn } from '@/data/remote/functions';
import { levelFromMetering, readRecording } from '@/features/capture/audio';
import { CaptureError, failureOf, type CaptureFailure } from '@/features/capture/CaptureError';
import { localTimezone, localYmd } from '@/features/capture/clock';
import { putHandoff } from '@/features/capture/handoff';
import { ProcessingView } from '@/features/capture/ProcessingView';
import { Waveform } from '@/features/capture/Waveform';
import { useI18n } from '@/i18n';
import { useStore } from '@/state/AppStore';
import { useLimits } from '@/state/limits';
import { haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { FUNCTIONS, VoiceResult } from '../../supabase/functions/_shared/contracts';

const MAX_SECONDS = 60;
const MIN_MILLIS = 1000;
type Phase = { kind: 'idle' } | { kind: 'recording' } | { kind: 'processing' } | { kind: 'failed'; failure: CaptureFailure };

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function VoiceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { state, refreshUsage } = useStore();
  const limits = useLimits();
  const paywall = usePaywall();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const rec = useAudioRecorderState(recorder, 100);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const seconds = Math.min(MAX_SECONDS, Math.floor(rec.durationMillis / 1000));

  const start = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return setPhase({ kind: 'failed', failure: 'permission' });
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      haptic('tap');
      setPhase({ kind: 'recording' });
    } catch (e) {
      setPhase({ kind: 'failed', failure: failureOf(e) });
    }
  };

  const stop = async () => {
    const millis = rec.durationMillis;
    setPhase({ kind: 'processing' });
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      if (!recorder.uri || millis < MIN_MILLIS) return setPhase({ kind: 'failed', failure: 'too_short' });
      const { audio, mimeType } = await readRecording(recorder.uri);
      const accounts = state.accounts.map((a) => ({ id: a.id, name: a.name, bank: a.bank, currency: a.currency }));
      const result = await invokeFn(FUNCTIONS.voice, { audio, mimeType, lang, today: localYmd(), timezone: localTimezone(), defaultCurrency: state.mainCurrency, accounts }, VoiceResult);
      refreshUsage();
      putHandoff('voice', { result });
      router.replace('/voice-review');
    } catch (e) {
      refreshUsage();
      const failure = failureOf(e);
      if (failure === 'quota') {
        setPhase({ kind: 'idle' });
        paywall(t('capture.voice.limitReason'));
      } else setPhase({ kind: 'failed', failure });
    }
  };

  // Batas 60 detik (FR-VOICE-1): berhenti otomatis.
  useEffect(() => {
    if (phase.kind === 'recording' && rec.durationMillis >= MAX_SECONDS * 1000) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.durationMillis, phase.kind]);

  if (limits.automation) {
    return (
      <Screen>
        <ScreenHeader title={t('capture.voice.title')} />
        <EmptyState kind="limit" title={t('capture.voice.limitTitle')} message={t('capture.voice.limitMessage')} actionLabel={t('capture.seePremium')} onAction={() => paywall(t('capture.voice.limitReason'))} />
      </Screen>
    );
  }

  const recording = phase.kind === 'recording';
  return (
    <Screen>
      <ScreenHeader title={t('capture.voice.title')} />
      {phase.kind === 'processing' ? (
        <View style={styles.center}>
          <ProcessingView title={t('capture.voice.processingTitle')} message={t('capture.voice.processingMessage')} />
        </View>
      ) : phase.kind === 'failed' ? (
        <CaptureError flow="voice" failure={phase.failure} actionLabel={t('capture.voice.rerecord')} onAction={() => setPhase({ kind: 'idle' })} />
      ) : (
        <View style={styles.center}>
          <Waveform active={recording} level={recording ? levelFromMetering(rec.metering) : undefined} />
          <AppText variant="display" numeric aria-live="polite">
            {clock(recording ? seconds : 0)}
          </AppText>
          <AppText variant="caption" tone="muted">{t('capture.voice.max', { time: clock(MAX_SECONDS) })}</AppText>
          <PressableScale
            accessibilityLabel={recording ? t('capture.voice.stop') : t('capture.voice.start')}
            onPress={recording ? stop : start}
            focusRadius={radius.full}
            scaleTo={0.94}
            style={[styles.mic, { backgroundColor: colors.accent }]}
          >
            <Icon icon={recording ? Square : Mic} color={colors.onAccent} size={36} />
          </PressableScale>
          <AppText variant="body" tone="secondary" align="center">
            {recording ? t('capture.voice.recordingHint') : t('capture.voice.idleHint')}
          </AppText>
          {!recording && (
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
