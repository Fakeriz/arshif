import { useRouter } from 'expo-router';
import { BellRing, Inbox, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, BottomSheet, Button, Card, Chip, Dialog, EmptyState, Icon, ListItem, Skeleton, Toggle, useToast } from '@/components/ui';
import { getBank } from '@/constants/banks';
import { useT } from '@/i18n';
import { SMARTLOG_APPS, type SmartLogApp } from '@/lib/smartlog/apps';
import { QUOTAS } from '@/lib/quota';
import { useStore } from '@/state/AppStore';
import { useSmartLog } from '@/state/smartlog';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** Layar Automation (FR-SLOG-1): saklar Smart Log, izin Android, dan tautan aplikasi bank ke kartu. */
export default function AutomationScreen() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const { show } = useToast();
  const { state } = useStore();
  const slog = useSmartLog();
  const [permDialog, setPermDialog] = useState(false);
  const [linking, setLinking] = useState<SmartLogApp | null>(null);

  const limit = QUOTAS[state.plan].automation;
  const used = state.usage.automation;
  const running = slog.supported && slog.enabled && slog.permission;

  const toggle = async (value: boolean) => {
    try {
      await slog.setEnabled(value);
      // FR-SLOG-1: aktif hanya bila izin diberikan DAN automation ON. Izin diminta saat menyalakan.
      if (value && slog.supported && !slog.permission) setPermDialog(true);
    } catch {
      show({ tone: 'error', title: t('slog.automation.toggleFailed') });
    }
  };

  const link = async (pkg: string, accountId: string | null) => {
    setLinking(null);
    try {
      await slog.setLink(pkg, accountId);
    } catch {
      show({ tone: 'error', title: t('slog.automation.linkFailed') });
    }
  };

  const statusText = !slog.enabled
    ? t('slog.automation.statusOff')
    : !slog.supported || slog.permission
      ? t('slog.automation.statusOn')
      : t('slog.automation.statusNoPermission');

  return (
    <Screen onRefresh={slog.status === 'ready' ? () => void slog.reload() : undefined}>
      <ScreenHeader title={t('slog.automation.title')} />
      {slog.status === 'error' ? (
        <EmptyState kind="error" title={t('slog.automation.loadErrorTitle')} message={t('slog.automation.loadErrorMessage')} actionLabel={t('common.retry')} onAction={() => void slog.reload()} />
      ) : slog.status !== 'ready' ? (
        <View style={styles.gap} accessibilityLabel={t('slog.automation.loading')} aria-busy>
          <Skeleton height={180} radius={radius.lg} />
          <Skeleton height={64} radius={radius.lg} />
          <Skeleton height={320} radius={radius.lg} />
        </View>
      ) : (
        <>
          <Card>
            <View style={styles.headRow}>
              <View style={[styles.badgeIcon, { backgroundColor: running ? colors.accentSoft : colors.track }]}>
                <Icon icon={BellRing} color={running ? colors.accentText : colors.textSecondary} />
              </View>
              <View style={styles.flex}>
                <AppText variant="h3">{t('slog.automation.smartLog')}</AppText>
                <AppText variant="caption" tone={slog.enabled && slog.supported && !slog.permission ? 'warning' : 'secondary'}>
                  {statusText}
                </AppText>
              </View>
              <Toggle value={slog.enabled} onChange={(v) => void toggle(v)} accessibilityLabel={t('slog.automation.smartLog')} />
            </View>
            <AppText variant="body" tone="secondary" style={styles.block}>
              {t('slog.automation.smartLogSub')}
            </AppText>
            <AppText variant="caption" tone="secondary" style={styles.blockSm}>
              {t('slog.automation.rule')}
            </AppText>
            <AppText variant="caption" tone="muted" style={styles.blockSm}>
              {t('slog.automation.privacy')}
            </AppText>
            {slog.enabled && slog.supported && !slog.permission && (
              <View style={styles.block}>
                <Button label={t('slog.automation.grant')} variant="primary" size="md" fullWidth onPress={() => setPermDialog(true)} />
              </View>
            )}
            {!slog.supported && (
              <View style={[styles.note, { borderColor: colors.border }]}>
                <AppText variant="bodyStrong">{t('slog.automation.unsupportedTitle')}</AppText>
                <AppText variant="caption" tone="secondary">
                  {t('slog.automation.unsupportedMessage')}
                </AppText>
              </View>
            )}
            <AppText variant="caption" tone="muted" style={styles.blockSm}>
              {limit === null ? t('slog.automation.quotaUnlimited') : t('slog.automation.quota', { used, limit })}
            </AppText>
          </Card>

          {slog.held > 0 && (
            <Card>
              <View style={styles.headRow}>
                <Icon icon={TriangleAlert} color={colors.warning} />
                <AppText variant="bodyStrong" style={styles.flex}>
                  {t('slog.automation.heldTitle')}
                </AppText>
              </View>
              <AppText variant="caption" tone="secondary" style={styles.blockSm}>
                {t('slog.automation.heldMessage', { count: slog.held })}
              </AppText>
              <View style={styles.blockSm}>
                <Button label={t('slog.automation.seePremium')} variant="secondary" size="md" onPress={() => router.push('/premium')} />
              </View>
            </Card>
          )}

          <Card padding="md">
            <ListItem
              leading={<Icon icon={Inbox} color={slog.review.length ? colors.accentText : colors.textSecondary} />}
              title={t('slog.automation.reviewEntry')}
              subtitle={slog.review.length ? t('slog.automation.reviewCount', { count: slog.review.length }) : t('slog.automation.reviewNone')}
              trailing={slog.review.length ? String(slog.review.length) : undefined}
              chevron
              onPress={() => router.push('/otomasi/tinjau')}
            />
          </Card>

          <View style={styles.gapSm}>
            <AppText variant="h3">{t('slog.automation.linksTitle')}</AppText>
            <AppText variant="caption" tone="secondary">
              {t('slog.automation.linksSub')}
            </AppText>
          </View>
          {state.accounts.length === 0 ? (
            <EmptyState compact title={t('slog.automation.noAccounts')} actionLabel={t('settings.title')} onAction={() => router.push('/pengaturan')} />
          ) : (
            <Card padding="md">
              {SMARTLOG_APPS.map((app, i) => {
                const linked = slog.links.find((l) => l.pkg === app.pkg);
                const account = linked ? state.accounts.find((a) => a.id === linked.accountId) : undefined;
                return (
                  <ListItem
                    key={app.pkg}
                    title={app.app}
                    subtitle={getBank(app.bank).name !== app.app ? getBank(app.bank).name : undefined}
                    trailing={account ? account.name : undefined}
                    trailingCaption={account ? undefined : t('slog.automation.notLinked')}
                    chevron
                    divider={i < SMARTLOG_APPS.length - 1}
                    onPress={() => setLinking(app)}
                    accessibilityLabel={`${app.app}, ${account ? account.name : t('slog.automation.notLinked')}`}
                  />
                );
              })}
            </Card>
          )}
        </>
      )}

      <BottomSheet
        visible={!!linking}
        onClose={() => setLinking(null)}
        title={linking ? t('slog.automation.linkSheetTitle', { app: linking.app }) : ''}
        subtitle={linking ? t('slog.automation.linkSheetSub', { app: linking.app }) : undefined}
      >
        {linking && (
          <View style={styles.gap}>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {state.accounts.map((a) => (
                <Chip
                  key={a.id}
                  label={`${a.name} · ${a.currency}`}
                  selected={slog.links.some((l) => l.pkg === linking.pkg && l.accountId === a.id)}
                  onPress={() => void link(linking.pkg, a.id)}
                />
              ))}
            </View>
            {slog.links.some((l) => l.pkg === linking.pkg) && (
              <Button label={t('slog.automation.unlink')} variant="secondary" size="md" fullWidth onPress={() => void link(linking.pkg, null)} />
            )}
          </View>
        )}
      </BottomSheet>

      <Dialog
        visible={permDialog}
        tone="info"
        title={t('slog.automation.permTitle')}
        message={t('slog.automation.permMessage')}
        confirmLabel={t('slog.automation.permOpen')}
        cancelLabel={t('slog.automation.permLater')}
        onConfirm={() => {
          setPermDialog(false);
          slog.openPermission();
        }}
        onCancel={() => setPermDialog(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  gapSm: { gap: space.xxs, paddingHorizontal: space.xs },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badgeIcon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  block: { marginTop: space.lg },
  blockSm: { marginTop: space.sm },
  note: { marginTop: space.lg, padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: space.xxs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
