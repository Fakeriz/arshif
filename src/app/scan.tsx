import * as ImagePicker from 'expo-image-picker';
import { FileScan, Images, X } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ForceDark } from '@/components/shell/ForceDark';
import { usePaywall } from '@/components/shell/Paywall';
import { AppText, EmptyState, GlassView, Icon, PressableScale } from '@/components/ui';
import { invokeFn } from '@/data/remote/functions';
import { discardPrivate, uploadPrivate } from '@/data/remote/upload';
import { CaptureError, failureOf, type CaptureFailure } from '@/features/capture/CaptureError';
import { putHandoff } from '@/features/capture/handoff';
import { compressReceipt, MAX_RECEIPT_BYTES } from '@/features/capture/image';
import { ProcessingView } from '@/features/capture/ProcessingView';
import { ScanFrame } from '@/features/capture/ScanFrame';
import { useI18n } from '@/i18n';
import { useStore } from '@/state/AppStore';
import { useLimits } from '@/state/limits';
import { haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { DocScannerNative } from '../../modules/doc-scanner';
import { FUNCTIONS, ScanResult } from '../../supabase/functions/_shared/contracts';

type Phase = { kind: 'ready' } | { kind: 'uploading' } | { kind: 'processing' } | { kind: 'failed'; failure: CaptureFailure } | { kind: 'noScanner'; reason: 'module' | 'services' };

/**
 * ML Kit Document Scanner (FR-OCR-6) hanya ada di development build baru (modul native `doc-scanner`) di Android
 * dengan Google Play services. Expo Go, iOS, web, dan build lama: 'module'.
 */
function docScannerState(): 'ok' | 'module' | 'services' {
  if (Platform.OS !== 'android' || !DocScannerNative) return 'module';
  try {
    return DocScannerNative.isAvailable() ? 'ok' : 'services';
  } catch {
    return 'services';
  }
}

export default function ScanScreen() {
  return (
    <ForceDark>
      <ScanInner />
    </ForceDark>
  );
}

function ScanInner() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, refreshUsage } = useStore();
  const limits = useLimits();
  const paywall = usePaywall();
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' });
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const scanner = docScannerState();

  /** Gambar yang sudah dipilih/dipindai masuk pipeline OCR yang sama: kompres, unggah, Gemini di server. */
  const process = async (asset: { uri: string; width?: number }) => {
    let receiptPath: string | null = null;
    try {
      if (!userId) return setPhase({ kind: 'failed', failure: 'session' });
      haptic('success');
      setPhase({ kind: 'uploading' });
      const uri = await compressReceipt(asset.uri, asset.width);
      receiptPath = await uploadPrivate({ bucket: 'receipts', userId, uri, ext: 'jpg', contentType: 'image/jpeg', maxBytes: MAX_RECEIPT_BYTES });
      setPhase({ kind: 'processing' });
      const result = await invokeFn(FUNCTIONS.scan, { path: receiptPath, lang }, ScanResult);
      refreshUsage();
      putHandoff('scan', { result, receiptPath });
      router.replace('/scan-review');
    } catch (e) {
      if (receiptPath) void discardPrivate('receipts', receiptPath);
      refreshUsage();
      const failure = failureOf(e);
      if (failure === 'quota') {
        setPhase({ kind: 'ready' });
        paywall(t('capture.scan.limitReason'));
      } else setPhase({ kind: 'failed', failure });
    }
  };

  const take = async (source: 'camera' | 'gallery') => {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return setPhase({ kind: 'failed', failure: 'permission' });
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
      const picked = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (picked.canceled || !picked.assets[0]) return;
      await process(picked.assets[0]);
    } catch (e) {
      setPhase({ kind: 'failed', failure: failureOf(e) });
    }
  };

  /** Scan dokumen: pemindai ML Kit (deteksi tepi + auto-crop), lalu pipeline OCR yang sama. */
  const scanDocument = async () => {
    if (scanner !== 'ok' || !DocScannerNative) return setPhase({ kind: 'noScanner', reason: scanner === 'ok' ? 'module' : scanner });
    try {
      const uri = await DocScannerNative.scan(true);
      if (!uri) return; // dibatalkan
      await process({ uri });
    } catch {
      setPhase({ kind: 'noScanner', reason: 'services' });
    }
  };

  // Dibuka dari "Scan dokumen" (+ Catat): pemindai langsung terbuka sekali.
  const autoLaunched = useRef(false);
  useEffect(() => {
    if (mode !== 'doc' || autoLaunched.current || limits.scan) return;
    autoLaunched.current = true;
    void scanDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, limits.scan]);

  let center;
  if (limits.scan) {
    center = <EmptyState kind="limit" title={t('capture.scan.limitTitle')} message={t('capture.scan.limitMessage')} actionLabel={t('capture.seePremium')} onAction={() => paywall(t('capture.scan.limitReason'))} />;
  } else if (phase.kind === 'uploading' || phase.kind === 'processing') {
    center = <ProcessingView title={phase.kind === 'uploading' ? t('capture.scan.uploading') : t('capture.scan.processingTitle')} message={t('capture.scan.processingMessage')} />;
  } else if (phase.kind === 'noScanner') {
    center = (
      <EmptyState
        title={t('capture.docScan.unavailableTitle')}
        message={phase.reason === 'module' ? t('capture.docScan.needNewBuild') : t('capture.docScan.needServices')}
        actionLabel={t('capture.docScan.useCamera')}
        onAction={() => setPhase({ kind: 'ready' })}
      />
    );
  } else if (phase.kind === 'failed') {
    const retry = phase.failure === 'permission' ? () => take('gallery') : () => setPhase({ kind: 'ready' });
    center = <CaptureError flow="scan" failure={phase.failure} actionLabel={phase.failure === 'permission' ? t('capture.scan.gallery') : t('capture.scan.retake')} onAction={retry} />;
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

  const canShoot = phase.kind === 'ready' && !limits.scan;
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl }]}>
      <View style={styles.top}>
        <RoundButton label={t('common.close')} onPress={() => router.back()} icon={X} />
        <AppText variant="h3" accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {t('capture.scan.title')}
        </AppText>
        <View style={styles.spacer} />
      </View>
      <View style={styles.center}>{center}</View>
      <AppText variant="caption" tone="muted" align="center">
        {t('capture.scan.cameraNote')}
      </AppText>
      <View style={styles.bottom}>
        <RoundButton label={t('capture.scan.gallery')} onPress={() => take('gallery')} icon={Images} disabled={!canShoot} />
        <PressableScale accessibilityLabel={t('capture.scan.shutter')} disabled={!canShoot} onPress={() => take('camera')} focusRadius={radius.full} scaleTo={0.94}>
          <View style={[styles.shutterRing, { borderColor: colors.text }]}>
            <View style={[styles.shutter, { backgroundColor: colors.text }]} />
          </View>
        </PressableScale>
        <RoundButton label={t('capture.docScan.button')} onPress={() => void scanDocument()} icon={FileScan} disabled={!canShoot} />
      </View>
    </View>
  );
}

function RoundButton({ label, onPress, icon, disabled }: { label: string; onPress: () => void; icon: typeof X; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale accessibilityLabel={label} aria-disabled={!!disabled} onPress={onPress} disabled={disabled} focusRadius={radius.full}>
      <GlassView level="floating" radius={radius.full} style={styles.round}>
        <Icon icon={icon} color={colors.text} />
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
