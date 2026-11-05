import { FileText, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { usePaywall } from '@/components/shell/Paywall';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Button, Card, EmptyState, Icon, Input, PressableScale } from '@/components/ui';
import { sampleStatement } from '@/data/seed';
import { ProcessingView } from '@/features/capture/ProcessingView';
import { AccountPicker } from '@/features/transactions/pickers';
import { useDemoState } from '@/state/demo';
import { useLedger } from '@/state/derived';
import { useLimits } from '@/state/limits';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

type Phase = 'form' | 'processing' | 'failed';

export default function ImportScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const demo = useDemoState();
  const limits = useLimits();
  const paywall = usePaywall();
  const { accounts } = useLedger();
  const [phase, setPhase] = useState<Phase>(demo === 'loading' ? 'processing' : 'form');
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [picked, setPicked] = useState(false);
  const [password, setPassword] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (limits.importPdf) {
    return (
      <Screen>
        <ScreenHeader title={t('capture.import.title')} />
        <EmptyState kind="limit" title={t('capture.import.limitTitle')} message={t('capture.import.limitMessage')} actionLabel={t('capture.seePremium')} onAction={() => paywall(t('capture.import.limitReason'))} />
      </Screen>
    );
  }

  const read = () => {
    setPhase('processing');
    if (demo === 'loading') return;
    timer.current = setTimeout(() => {
      if (demo === 'error') setPhase('failed');
      else router.replace({ pathname: '/import-review', params: { akun: accountId ?? '' } });
    }, 1600);
  };

  return (
    <Screen>
      <ScreenHeader title={t('capture.import.title')} />
      {phase === 'processing' ? (
        <View style={styles.center}>
          <ProcessingView title={t('capture.import.processingTitle')} message={t('capture.import.processingMessage')} />
        </View>
      ) : phase === 'failed' ? (
        <EmptyState kind="error" title={t('capture.import.failedTitle')} message={t('capture.import.failedMessage')} actionLabel={t('capture.import.repick')} onAction={() => setPhase('form')} />
      ) : (
        <View style={styles.form}>
          <AccountPicker label={t('capture.import.intoAccount')} accounts={accounts} value={accountId} onChange={setAccountId} />
          {picked ? (
            <Card>
              <View style={styles.file}>
                <View style={[styles.fileIcon, { backgroundColor: colors.accentSoft }]}>
                  <Icon icon={FileText} color={colors.accentText} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {sampleStatement.fileName}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {sampleStatement.sizeLabel}
                  </AppText>
                </View>
                <PressableScale accessibilityLabel={t('capture.import.removeFile')} onPress={() => setPicked(false)} focusRadius={radius.full} style={styles.remove}>
                  <Icon icon={X} color={colors.textSecondary} />
                </PressableScale>
              </View>
            </Card>
          ) : (
            <Button label={t('capture.import.pickFile')} icon={FileText} variant="secondary" fullWidth onPress={() => setPicked(true)} />
          )}
          <Input label={t('capture.import.password')} value={password} onChangeText={setPassword} secureTextEntry hint={t('capture.import.passwordHint')} />
          <AppText variant="caption" tone="muted">
            {t('capture.import.limits')}
          </AppText>
          <Button label={t('capture.import.read')} fullWidth disabled={!picked || !accountId} onPress={read} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: space.x3 },
  form: { gap: space.xl },
  file: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  fileIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
