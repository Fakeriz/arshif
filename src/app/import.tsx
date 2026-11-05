import * as DocumentPicker from 'expo-document-picker';
import { FileText, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePaywall } from '@/components/shell/Paywall';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Button, Card, EmptyState, Icon, PressableScale } from '@/components/ui';
import { invokeFn } from '@/data/remote/functions';
import { uploadPrivate } from '@/data/remote/upload';
import { CaptureError, failureOf, type CaptureFailure } from '@/features/capture/CaptureError';
import { putHandoff } from '@/features/capture/handoff';
import { ProcessingView } from '@/features/capture/ProcessingView';
import { AccountPicker } from '@/features/transactions/pickers';
import { useI18n } from '@/i18n';
import { useActiveAccountId, useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';
import { useLimits } from '@/state/limits';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { FUNCTIONS, ImportResult } from '../../supabase/functions/_shared/contracts';

const MAX_BYTES = 15 * 1024 * 1024;
type Phase = { kind: 'form' } | { kind: 'uploading' } | { kind: 'processing' } | { kind: 'failed'; failure: CaptureFailure };
type Picked = { uri: string; name: string; size: number | null };

const sizeLabel = (b: number | null) => (b === null ? '' : b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function ImportScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const { userId, refreshUsage } = useStore();
  const limits = useLimits();
  const paywall = usePaywall();
  const { accounts } = useLedger();
  const activeId = useActiveAccountId();
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [accountId, setAccountId] = useState<string | null>(activeId ?? accounts[0]?.id ?? null);
  const [file, setFile] = useState<Picked | null>(null);

  if (limits.importPdf) {
    return (
      <Screen>
        <ScreenHeader title={t('capture.import.title')} />
        <EmptyState kind="limit" title={t('capture.import.limitTitle')} message={t('capture.import.limitMessage')} actionLabel={t('capture.seePremium')} onAction={() => paywall(t('capture.import.limitReason'))} />
      </Screen>
    );
  }

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if (a.size !== undefined && a.size > MAX_BYTES) return setPhase({ kind: 'failed', failure: 'too_large' });
    setFile({ uri: a.uri, name: a.name, size: a.size ?? null });
  };

  const read = async () => {
    if (!file || !accountId) return;
    if (!userId) return setPhase({ kind: 'failed', failure: 'session' });
    try {
      setPhase({ kind: 'uploading' });
      const path = await uploadPrivate({ bucket: 'statements', userId, uri: file.uri, ext: 'pdf', contentType: 'application/pdf', maxBytes: MAX_BYTES });
      setPhase({ kind: 'processing' });
      const result = await invokeFn(FUNCTIONS.import, { path, accountId, lang }, ImportResult);
      refreshUsage();
      putHandoff('import', { result, accountId });
      router.replace('/import-review');
    } catch (e) {
      refreshUsage();
      const failure = failureOf(e);
      if (failure === 'quota') {
        setPhase({ kind: 'form' });
        paywall(t('capture.import.limitReason'));
      } else setPhase({ kind: 'failed', failure });
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t('capture.import.title')} />
      {phase.kind === 'uploading' || phase.kind === 'processing' ? (
        <View style={styles.center}>
          <ProcessingView title={phase.kind === 'uploading' ? t('capture.import.uploading') : t('capture.import.processingTitle')} message={t('capture.import.processingMessage')} />
        </View>
      ) : phase.kind === 'failed' ? (
        <CaptureError
          flow="import"
          failure={phase.failure}
          actionLabel={t('capture.import.repick')}
          onAction={() => {
            setFile(null);
            setPhase({ kind: 'form' });
          }}
        />
      ) : (
        <View style={styles.form}>
          <AccountPicker label={t('capture.import.intoAccount')} accounts={accounts} value={accountId} onChange={setAccountId} />
          {file ? (
            <Card>
              <View style={styles.file}>
                <View style={[styles.fileIcon, { backgroundColor: colors.accentSoft }]}>
                  <Icon icon={FileText} color={colors.accentText} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {file.name}
                  </AppText>
                  {file.size !== null && (
                    <AppText variant="caption" tone="muted">
                      {sizeLabel(file.size)}
                    </AppText>
                  )}
                </View>
                <PressableScale accessibilityLabel={t('capture.import.removeFile')} onPress={() => setFile(null)} focusRadius={radius.full} style={styles.remove}>
                  <Icon icon={X} color={colors.textSecondary} />
                </PressableScale>
              </View>
            </Card>
          ) : (
            <Button label={t('capture.import.pickFile')} icon={FileText} variant="secondary" fullWidth onPress={pick} />
          )}
          <View style={styles.notes}>
            <AppText variant="caption" tone="muted">
              {t('capture.import.passwordNote')}
            </AppText>
            <AppText variant="caption" tone="muted">
              {t('capture.import.limits')}
            </AppText>
          </View>
          <Button label={t('capture.import.read')} fullWidth disabled={!file || !accountId} onPress={read} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: space.x3 },
  form: { gap: space.xl },
  notes: { gap: space.xs },
  file: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  fileIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
