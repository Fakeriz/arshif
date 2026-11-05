import { Images, X, Zap, ZapOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { usePaywall } from '@/components/shell/Paywall';
import { AppText, EmptyState, GlassView, Icon, PressableScale } from '@/components/ui';
import { ProcessingView } from '@/features/capture/ProcessingView';
import { ScanFrame } from '@/features/capture/ScanFrame';
import { useDemoState } from '@/state/demo';
import { useLimits } from '@/state/limits';
import { haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { ForceDark } from '@/components/shell/ForceDark';

type Phase = 'ready' | 'processing' | 'failed';

export default function ScanScreen() {
  return (
    <ForceDark>
      <ScanInner />
    </ForceDark>
  );
}

function ScanInner() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const demo = useDemoState();
  const limits = useLimits();
  const paywall = usePaywall();
  const [phase, setPhase] = useState<Phase>(demo === 'loading' ? 'processing' : 'ready');
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const capture = () => {
    haptic('success');
    setPhase('processing');
    if (demo === 'loading') return;
    timer.current = setTimeout(() => {
      if (demo === 'error') setPhase('failed');
      else router.replace('/scan-review');
    }, 1600);
  };

  const close = () => router.back();

  let center;
  if (limits.scan) {
    center = <EmptyState kind="limit" title={t('capture.scan.limitTitle')} message={t('capture.scan.limitMessage')} actionLabel={t('capture.seePremium')} onAction={() => paywall(t('capture.scan.limitReason'))} />;
  } else if (phase === 'processing') {
    center = <ProcessingView title={t('capture.scan.processingTitle')} message={t('capture.scan.processingMessage')} />;
  } else if (phase === 'failed') {
    center = <EmptyState kind="error" title={t('capture.scan.failedTitle')} message={t('capture.scan.failedMessage')} actionLabel={t('capture.scan.retake')} onAction={() => setPhase('ready')} />;
  } else {
    center = (
      <>
        <ScanFrame active />
        <AppText variant="body" tone="secondary" align="center">
          {t('capture.scan.guide')}
        </AppText>
      </>
    );
  }

  const canShoot = phase === 'ready' && !limits.scan;
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl }]}>
      <View style={styles.top}>
        <RoundButton label={t('common.close')} onPress={close} icon={X} />
        <AppText variant="h3" accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {t('capture.scan.title')}
        </AppText>
        <RoundButton label={flash ? t('capture.scan.flashOff') : t('capture.scan.flashOn')} onPress={() => setFlash((f) => !f)} icon={flash ? Zap : ZapOff} selected={flash} />
      </View>
      <View style={styles.center}>{center}</View>
      <AppText variant="caption" tone="muted" align="center">
        {t('capture.scan.cameraNote')}
      </AppText>
      <View style={styles.bottom}>
        <RoundButton label={t('capture.scan.gallery')} onPress={capture} icon={Images} disabled={!canShoot} />
        <PressableScale accessibilityLabel={t('capture.scan.shutter')} disabled={!canShoot} onPress={capture} focusRadius={radius.full} scaleTo={0.94}>
          <View style={[styles.shutterRing, { borderColor: colors.text }]}>
            <View style={[styles.shutter, { backgroundColor: colors.text }]} />
          </View>
        </PressableScale>
        <View style={styles.spacer} />
      </View>
    </View>
  );
}

function RoundButton({ label, onPress, icon, selected, disabled }: { label: string; onPress: () => void; icon: typeof X; selected?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale accessibilityLabel={label} aria-selected={!!selected} aria-disabled={!!disabled} onPress={onPress} disabled={disabled} focusRadius={radius.full}>
      <GlassView level="floating" radius={radius.full} style={styles.round}>
        <Icon icon={icon} color={selected ? colors.accentText : colors.text} />
      </GlassView>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.lg, gap: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { flexShrink: 1 },
  center: { flex: 1, justifyContent: 'center', gap: space.xl },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md },
  round: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  shutterRing: { width: 80, height: 80, borderRadius: radius.full, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 62, height: 62, borderRadius: radius.full },
  spacer: { width: 48 },
});
