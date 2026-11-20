import * as ImagePicker from 'expo-image-picker';
import { Camera, Images, X } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ForceDark } from '@/components/shell/ForceDark';
import { usePaywall } from '@/components/shell/Paywall';
import { AppText, Button, EmptyState, GlassView, Icon, PressableScale, useToast } from '@/components/ui';
import { invokeFn } from '@/data/remote/functions';
import { discardPrivate, uploadPrivate } from '@/data/remote/upload';
import { CaptureError, failureOf, type CaptureFailure } from '@/features/capture/CaptureError';
import { peekHandoff, putHandoff } from '@/features/capture/handoff';
import { compressReceipt, MAX_RECEIPT_BYTES } from '@/features/capture/image';
import { ProcessingView } from '@/features/capture/ProcessingView';
import { pickReceipts, SCAN_SOURCES, takePendingPick, type PickedReceipt, type ScanSource } from '@/features/capture/scanLaunch';
import { useI18n } from '@/i18n';
import { useStore } from '@/state/AppStore';
import { useLimits } from '@/state/limits';
import { haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { goBack } from '@/components/shell/goBack';

import { DocScannerNative } from '../../modules/doc-scanner';
import { FUNCTIONS, ScanResult } from '../../supabase/functions/_shared/contracts';

/** launching = kamera/pemindai sedang terbuka di atas layar ini; choose = tombol ambil foto / pilih dari galeri. */
/** n/total: struk ke-n dari beberapa struk (multi). */
type Phase = { kind: 'launching' } | { kind: 'choose' } | { kind: 'uploading'; n: number; total: number } | { kind: 'processing'; n: number; total: number } | { kind: 'failed'; failure: CaptureFailure };

/**
 * Pemindai dokumen (FR-OCR-6), deteksi tepi + potong otomatis lewat modul native `doc-scanner`:
 * ML Kit di Android (butuh Google Play services), VisionKit di iOS. Tidak ada (web, Expo Go, build lama): kamera bawaan.
 */
function scannerReady(): boolean {
  if (Platform.OS === 'web' || !DocScannerNative) return false;
  try {
    return DocScannerNative.isAvailable();
  } catch {
    return false;
  }
}

/** Browser tidak mengizinkan membuka kamera/berkas tanpa ketukan pengguna: di web kamera dibuka oleh tombol yang membuka layar ini (openCapture). */
const autoLaunch = Platform.OS !== 'web';

export default function ScanScreen() {
  return (
    <ForceDark>
      <ScanInner />
    </ForceDark>
  );
}

/**
 * Receipt OCR: ketuk = kamera langsung terbuka (pemindai ML Kit di Android, VisionKit di iOS, atau kamera bawaan). Tidak ada layar "kamera"
 * perantara: layar ini hanya untuk mengunggah/memproses, error, dan tombol ambil foto / galeri (web, atau setelah batal
 * di pemindai yang tidak punya galeri).
 */
function ScanInner() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { userId, refreshUsage } = useStore();
  const limits = useLimits();
  const paywall = usePaywall();
  const { show } = useToast();
  const params = useLocalSearchParams<{ src?: string }>();
  // Tanpa src (Foto ulang, layar lama): kamera.
  const source: ScanSource = SCAN_SOURCES.find((s) => s === params.src) ?? 'camera';
  // Web: foto yang sedang diambil dari ketukan "Struk OCR"; tanpa itu (mis. halaman dimuat ulang) tampil tombol pilihan.
  const [webPick] = useState(takePendingPick);
  const [phase, setPhase] = useState<Phase>(autoLaunch || webPick ? { kind: 'launching' } : { kind: 'choose' });

  /** Unggah + baca satu struk lewat pipeline OCR yang sama (Gemini di server). Foto dikompres dulu; PDF apa adanya. */
  const scanOne = async (file: PickedReceipt, n: number, total: number) => {
    let receiptPath: string | null = null;
    try {
      setPhase({ kind: 'uploading', n, total });
      const uri = file.pdf ? file.uri : await compressReceipt(file.uri, file.width);
      const [ext, contentType] = file.pdf ? ['pdf', 'application/pdf'] : ['jpg', 'image/jpeg'];
      receiptPath = await uploadPrivate({ bucket: 'receipts', userId: userId!, uri, ext, contentType, maxBytes: MAX_RECEIPT_BYTES });
      setPhase({ kind: 'processing', n, total });
      const result = await invokeFn(FUNCTIONS.scan, { path: receiptPath, lang }, ScanResult);
      return { result, receiptPath };
    } catch (e) {
      if (receiptPath) void discardPrivate('receipts', receiptPath);
      throw e;
    }
  };

  /**
   * Beberapa struk dibaca berurutan (kuota dihitung server satu per satu). Yang gagal dilewati dan kuotanya tidak terpotong;
   * yang berhasil dicek satu per satu di layar review (antrean di handoff).
   */
  const process = async (files: PickedReceipt[]) => {
    if (!userId) return setPhase({ kind: 'failed', failure: 'session' });
    haptic('success');
    const done: { result: ScanResult; receiptPath: string }[] = [];
    let firstFailure: CaptureFailure | null = null;
    for (const [i, file] of files.entries()) {
      try {
        done.push(await scanOne(file, i + 1, files.length));
      } catch (e) {
        firstFailure ??= failureOf(e);
        if (firstFailure === 'quota' || firstFailure === 'session') break;
      }
    }
    refreshUsage();
    const [first, ...rest] = done;
    if (!first) {
      if (firstFailure === 'quota') {
        setPhase({ kind: 'choose' });
        return paywall(t('capture.scan.limitReason'));
      }
      return setPhase({ kind: 'failed', failure: firstFailure ?? 'server' });
    }
    if (done.length < files.length) show({ tone: 'error', title: t('capture.source.partialFailed', { count: files.length - done.length }) });
    putHandoff('scan', { result: first.result, receiptPath: first.receiptPath });
    // Foto ulang di tengah antrean: struk baru dicek dulu, antrean lama tetap menunggu di belakangnya.
    putHandoff('scanQueue', [...rest, ...(peekHandoff('scanQueue') ?? [])]);
    router.replace('/scan-review');
  };

  /**
   * Batal. Pemindai ML Kit (Android) sudah punya galeri di dalamnya, jadi batal = kembali ke layar sebelumnya.
   * Pemindai iOS dan kamera bawaan tidak punya galeri: tampilkan pilihan ambil foto / galeri.
   */
  const cancelled = (hadGallery: boolean) => (autoLaunch && (hadGallery || source !== 'camera') ? goBack(router) : setPhase({ kind: 'choose' }));

  const take = async (from: ScanSource) => {
    try {
      // Web: izin kamera diurus browser; await di sini memutus ketukan pengguna sehingga kamera tidak terbuka.
      if (from === 'camera' && Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return setPhase({ kind: 'failed', failure: 'permission' });
      }
      const files = await pickReceipts(from, limits.scanLeft ?? undefined);
      if (!files.length) return cancelled(false);
      await process(files);
    } catch (e) {
      setPhase({ kind: 'failed', failure: failureOf(e) });
    }
  };

  /** Kamera utama: pemindai dokumen; tanpa pemindai atau bila gagal dibuka, kamera bawaan. */
  const openCamera = async () => {
    setPhase({ kind: 'launching' });
    if (!scannerReady() || !DocScannerNative) return take('camera');
    let uri: string | null;
    try {
      uri = await DocScannerNative.scan(true);
    } catch {
      return take('camera');
    }
    if (!uri) return cancelled(Platform.OS === 'android');
    await process([{ uri }]);
  };

  const launched = useRef(false);
  useEffect(() => {
    if (launched.current || limits.scan) return;
    if (webPick) {
      launched.current = true;
      webPick
        .then((files) => (files.length ? process(files) : cancelled(false)))
        .catch((e) => setPhase({ kind: 'failed', failure: failureOf(e) }));
      return;
    }
    if (!autoLaunch) return;
    launched.current = true;
    void (source === 'camera' ? openCamera() : take(source));
    // Sekali saat layar dibuka; ketukan "Foto ulang" memanggil openCamera sendiri.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limits.scan]);

  let center;
  if (limits.scan) {
    center = <EmptyState kind="limit" title={t('capture.scan.limitTitle')} message={t('capture.scan.limitMessage')} actionLabel={t('capture.seePremium')} onAction={() => paywall(t('capture.scan.limitReason'))} />;
  } else if (phase.kind === 'uploading' || phase.kind === 'processing') {
    center = (
      <ProcessingView
        title={`${phase.kind === 'uploading' ? t('capture.scan.uploading') : t('capture.scan.processingTitle')}${phase.total > 1 ? ` (${phase.n}/${phase.total})` : ''}`}
        message={t('capture.scan.processingMessage')}
        steps={[t('capture.steps.uploadPhoto'), t('capture.steps.readReceipt'), t('capture.steps.review')]}
        done={phase.kind === 'uploading' ? 0 : 1}
      />
    );
  } else if (phase.kind === 'failed') {
    const retry = phase.failure === 'permission' ? () => take('gallery') : autoLaunch ? () => void openCamera() : () => setPhase({ kind: 'choose' });
    center = <CaptureError flow="scan" failure={phase.failure} actionLabel={phase.failure === 'permission' ? t('capture.scan.gallery') : t('capture.scan.retake')} onAction={retry} />;
  } else if (phase.kind === 'choose') {
    center = (
      <View style={styles.choices}>
        <AppText variant="body" tone="secondary" align="center">
          {t('capture.scan.cameraNote')}
        </AppText>
        <Button label={t('capture.scan.shutter')} icon={Camera} fullWidth onPress={() => void (autoLaunch ? openCamera() : take('camera'))} />
        <Button label={t('capture.scan.gallery')} icon={Images} variant="secondary" fullWidth onPress={() => void take('gallery')} />
      </View>
    );
  } else center = null; // launching: kamera/pemindai sedang terbuka di atas layar ini

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl }]}>
      <View style={styles.top}>
        <RoundButton label={t('common.close')} onPress={() => goBack(router)} icon={X} />
        <AppText variant="h3" accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {t('capture.scan.title')}
        </AppText>
        <View style={styles.spacer} />
      </View>
      <View style={styles.center}>{center}</View>
    </View>
  );
}

function RoundButton({ label, onPress, icon }: { label: string; onPress: () => void; icon: typeof X }) {
  const { colors } = useTheme();
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} focusRadius={radius.full}>
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
  choices: { gap: space.md },
  round: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: 48 },
});
