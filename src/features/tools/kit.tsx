import { Info, Lock } from 'lucide-react-native';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePaywall } from '@/components/shell/Paywall';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Card, EmptyState, Icon, Skeleton, useToast } from '@/components/ui';
import { featureGate } from '@/data/remote/invoices';
import { QuotaError } from '@/data/remote/planning';
import { useT } from '@/i18n';
import { PdfUnavailableError, sharePdf } from '@/lib/pdf/share';
import { isLimited } from '@/lib/quota';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export type GateKey = 'taxFull' | 'pdfExport';
export type GateState = 'checking' | 'open' | 'locked' | 'error';

/**
 * Fitur Premium (FR-TAX-3). Paket Free di klien: langsung terkunci tanpa memanggil server.
 * Paket Premium: server memastikan lewat feature_gate (paket dibaca dari profil di server).
 */
export function useFeatureGate(key: GateKey): { state: GateState; retry: () => void } {
  const { state: app, userId } = useStore();
  const freeLocked = isLimited(app.plan, key, 0);
  const [state, setState] = useState<GateState>(freeLocked ? 'locked' : 'checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (freeLocked) {
      setState('locked');
      return;
    }
    if (!userId) {
      setState('open');
      return;
    }
    let live = true;
    setState('checking');
    featureGate(key)
      .then(() => live && setState('open'))
      .catch((e) => live && setState(e instanceof QuotaError ? 'locked' : 'error'));
    return () => {
      live = false;
    };
  }, [key, freeLocked, userId, attempt]);

  return { state, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}

export function ToolScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Screen>
      <ScreenHeader title={title} />
      {children}
    </Screen>
  );
}

/**
 * Isi layar Premium: memeriksa gerbang dulu. Terkunci = penjelasan + tombol ke Premium (sheet paywall dengan
 * alasan spesifik), bukan error mentah.
 */
export function GatedBody({ gate, reason, lockedTitle, children }: { gate: { state: GateState; retry: () => void }; reason: string; lockedTitle: string; children: ReactNode }) {
  const t = useT();
  const paywall = usePaywall();
  useEffect(() => {
    if (gate.state === 'locked') paywall(reason);
  }, [gate.state, paywall, reason]);

  if (gate.state === 'checking') {
    return (
      <View style={styles.skeleton} accessibilityLabel={t('tools.common.checking')} aria-busy>
        <Skeleton height={120} radius={radius.lg} />
        <Skeleton height={200} radius={radius.lg} />
      </View>
    );
  }
  if (gate.state === 'error') {
    return <EmptyState kind="error" title={t('tools.common.gateErrorTitle')} message={t('tools.common.gateErrorMessage')} actionLabel={t('common.retry')} onAction={gate.retry} />;
  }
  if (gate.state === 'locked') {
    return <EmptyState icon={Lock} title={lockedTitle} message={reason} actionLabel={t('tools.common.seePremium')} onAction={() => paywall(reason)} />;
  }
  return <>{children}</>;
}

/** FR-TAX-4: tampil di setiap layar pajak. */
export function TaxDisclaimer() {
  const t = useT();
  const { colors } = useTheme();
  return (
    <Card variant="outline" padding="md">
      <View style={styles.row}>
        <Icon icon={Info} color={colors.textSecondary} size={18} />
        <AppText variant="caption" tone="secondary" style={styles.flex}>
          {t('tools.tax.disclaimer')}
        </AppText>
      </View>
    </Card>
  );
}

/** Buat PDF lalu bagikan. Pesan jujur bila build aplikasi belum punya modul cetak. */
export function usePdfShare() {
  const t = useT();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (build: () => string, fileBase: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await sharePdf(build(), fileBase);
    } catch (e) {
      if (e instanceof PdfUnavailableError) show({ tone: 'warning', title: t('tools.pdf.unavailableTitle'), message: t('tools.pdf.unavailableMessage') });
      else show({ tone: 'error', title: t('tools.pdf.failed') });
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/** Tombol PDF Export Premium: gerbang server diperiksa saat diketuk, terkunci = paywall. */
export function usePdfExportGate() {
  const t = useT();
  const paywall = usePaywall();
  const { show } = useToast();
  const { state: app, userId } = useStore();
  return async (): Promise<boolean> => {
    const reason = t('tools.export.reason');
    if (isLimited(app.plan, 'pdfExport', 0)) {
      paywall(reason);
      return false;
    }
    if (!userId) return true;
    try {
      await featureGate('pdfExport');
      return true;
    } catch (e) {
      if (e instanceof QuotaError) paywall(reason);
      else show({ tone: 'error', title: t('tools.common.gateErrorTitle') });
      return false;
    }
  };
}

export function ResultRow({ label, value, strong, minus }: { label: string; value: string; strong?: boolean; minus?: boolean }) {
  return (
    <View style={styles.result}>
      <AppText variant={strong ? 'bodyStrong' : 'body'} tone={strong ? 'primary' : 'secondary'} style={styles.flex}>
        {label}
      </AppText>
      <AppText variant={strong ? 'bodyStrong' : 'body'} numeric align="right">
        {minus ? `− ${value}` : value}
      </AppText>
    </View>
  );
}


const styles = StyleSheet.create({
  skeleton: { gap: space.lg },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  flex: { flex: 1, minWidth: 0 },
  result: { flexDirection: 'row', alignItems: 'baseline', gap: space.md, paddingVertical: space.xs + 2 },
});
