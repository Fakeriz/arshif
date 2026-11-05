import { Images, X, Zap, ZapOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    center = <EmptyState kind="limit" title="Kuota scan bulan ini habis" message="Reset tanggal 1, atau upgrade untuk 300 scan per bulan." actionLabel="Lihat Premium" onAction={() => paywall('Kuota scan struk Free (20/bulan) sudah habis.')} />;
  } else if (phase === 'processing') {
    center = <ProcessingView title="Membaca struk" message="AI mengekstrak toko, tanggal, total, dan item. Kalau gagal, kuota tidak terpotong." />;
  } else if (phase === 'failed') {
    center = <EmptyState kind="error" title="Struk tidak terbaca" message="Kuota scan tidak terpotong. Coba foto ulang di tempat yang lebih terang dan pastikan seluruh struk masuk bingkai." actionLabel="Foto ulang" onAction={() => setPhase('ready')} />;
  } else {
    center = (
      <>
        <ScanFrame active />
        <AppText variant="body" tone="secondary" align="center">
          Posisikan struk di dalam bingkai. Pastikan semua tulisan terlihat jelas.
        </AppText>
      </>
    );
  }

  const canShoot = phase === 'ready' && !limits.scan;
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl }]}>
      <View style={styles.top}>
        <RoundButton label="Tutup" onPress={close} icon={X} />
        <AppText variant="h3" accessibilityRole="header">
          Scan struk
        </AppText>
        <RoundButton label={flash ? 'Matikan lampu kilat' : 'Nyalakan lampu kilat'} onPress={() => setFlash((f) => !f)} icon={flash ? Zap : ZapOff} selected={flash} />
      </View>
      <View style={styles.center}>{center}</View>
      <AppText variant="caption" tone="muted" align="center">
        Pratinjau kamera aktif di build native (Fase 2). Di sini hasilnya contoh.
      </AppText>
      <View style={styles.bottom}>
        <RoundButton label="Pilih dari galeri" onPress={capture} icon={Images} disabled={!canShoot} />
        <PressableScale accessibilityLabel="Ambil foto struk" disabled={!canShoot} onPress={capture} focusRadius={radius.full} scaleTo={0.94}>
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
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { flex: 1, justifyContent: 'center', gap: space.xl },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md },
  round: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  shutterRing: { width: 80, height: 80, borderRadius: radius.full, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 62, height: 62, borderRadius: radius.full },
  spacer: { width: 48 },
});
