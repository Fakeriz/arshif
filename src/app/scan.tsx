import { X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ForceDark } from '@/components/shell/ForceDark';
import { usePaywall } from '@/components/shell/Paywall';
import { AppText, EmptyState, GlassView, Icon, PressableScale, useToast } from '@/components/ui';
import { invokeFn } from '@/data/remote/functions';
import { discardPrivate, uploadPrivate } from '@/data/remote/upload';
import { CaptureError, failureOf, type CaptureFailure } from '@/features/capture/CaptureError';
import { peekHandoff, putHandoff } from '@/features/capture/handoff';
import { compressReceipt, MAX_RECEIPT_BYTES } from '@/features/capture/image';
import { ProcessingView } from '@/features/capture/ProcessingView';
import { acquireReceipts, CameraPermissionError, clearPendingPick, pendingPick, type PickedReceipt, type ScanSource } from '@/features/capture/scanLaunch';
import { useI18n } from '@/i18n';
import { useStore } from '@/state/AppStore';
import { useLimits } from '@/state/limits';
import { haptic } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { goBack } from '@/components/shell/goBack';
import { aiCategories } from '@/constants/categories';

import { FUNCTIONS, ScanResult } from '../../supabase/functions/_shared/contracts';

/** n/total: struk ke-n dari beberapa struk (multi). */
type Phase = { kind: 'starting' } | { kind: 'uploading'; n: number; total: number } | { kind: 'processing'; n: number; total: number } | { kind: 'failed'; failure: CaptureFailure };

export default function ScanScreen() {
  return (
    <ForceDark>
      <ScanInner />
    </ForceDark>
  );
}

/**
 * Receipt OCR: struk sudah diambil dari sheet Scan struk (startScan) sebelum layar ini dibuka, jadi layar ini hanya
 * progres unggah/membaca dan error. Tidak ada tombol pilihan di sini: semua cara ada di sheet.
 */
function ScanInner() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { state, userId, refreshUsage } = useStore();
  const limits = useLimits();
  const paywall = usePaywall();
  const { show } = useToast();
  const [pick] = useState(pendingPick);
  const [phase, setPhase] = useState<Phase>({ kind: 'starting' });
  const [fileName, setFileName] = useState('receipt.jpg');

  /** Unggah + baca satu struk lewat pipeline OCR yang sama (Gemini di server). Foto dikompres dulu; PDF apa adanya. */
  const scanOne = async (file: PickedReceipt, n: number, total: number) => {
    let receiptPath: string | null = null;
    try {
      const cleanName = file.uri.split(/[\\/]/).pop()?.split('?')[0] || (file.pdf ? 'receipt.pdf' : 'receipt.jpg');
      setFileName(cleanName);
      setPhase({ kind: 'uploading', n, total });
      const uri = file.pdf ? file.uri : await compressReceipt(file.uri, file.width);
      const [ext, contentType] = file.pdf ? ['pdf', 'application/pdf'] : ['jpg', 'image/jpeg'];
      receiptPath = await uploadPrivate({ bucket: 'receipts', userId: userId!, uri, ext, contentType, maxBytes: MAX_RECEIPT_BYTES });
      setPhase({ kind: 'processing', n, total });
      const result = await invokeFn(FUNCTIONS.scan, { path: receiptPath, lang, categories: aiCategories(state.categories) }, ScanResult);
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
        goBack(router);
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

  const run = (files: Promise<PickedReceipt[]>) =>
    files.then(
      (f) => (f.length ? process(f) : undefined), // batal di "Coba lagi": tetap di layar error
      (e) => setPhase({ kind: 'failed', failure: e instanceof CameraPermissionError ? 'permission' : failureOf(e) }),
    );

  const started = useRef(false);
  useEffect(() => {
    if (started.current || limits.scan) return;
    started.current = true;
    // Dibuka tanpa struk (muat ulang halaman, tautan langsung): kembali ke layar sebelumnya, pilihan ada di sheet.
    if (!pick) return goBack(router);
    clearPendingPick();
    void run(pick.files);
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
        upload={{
          fileName,
          progress: phase.kind === 'uploading' ? Math.max(0.15, (phase.n - 0.5) / phase.total) : phase.n / phase.total,
        }}
        steps={[t('capture.steps.uploadPhoto'), t('capture.steps.readReceipt'), t('capture.steps.review')]}
        done={phase.kind === 'uploading' ? 0 : 1}
      />
    );
  } else if (phase.kind === 'failed') {
    // Ketukan ini yang membuka pemilih lagi (web butuh ketukan). Izin kamera ditolak: galeri.
    const again: ScanSource = phase.failure === 'permission' ? 'gallery' : (pick?.source ?? 'camera');
    center = (
      <CaptureError
        flow="scan"
        failure={phase.failure}
        actionLabel={phase.failure === 'permission' ? t('capture.scan.gallery') : t('capture.scan.retake')}
        onAction={() => void run(acquireReceipts(again, limits.scanLeft ?? undefined))}
      />
    );
  } else center = null; // starting: sesaat sebelum unggah dimulai

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
  round: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: 48 },
});
