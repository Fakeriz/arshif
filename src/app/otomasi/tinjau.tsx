import { useRouter } from 'expo-router';
import { CircleHelp } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Button, Card, CurrencyText, EmptyState, Group, Icon, ListItem, Skeleton, useToast } from '@/components/ui';
import { getBank } from '@/constants/banks';
import type { SmartLogItem } from '@/data/remote/smartlog';
import { RuleSheet } from '@/features/smartlog/RuleSheet';
import { useI18n } from '@/i18n';
import { dayLabel } from '@/lib/dates';
import { smartLogApp } from '@/lib/smartlog/apps';
import type { SmartLogRuleInput } from '@/lib/smartlog/rules';
import { useStore } from '@/state/AppStore';
import { draftFromItem, useSmartLog } from '@/state/smartlog';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** To Review (FR-SLOG-3/4): notifikasi yang meragukan baru dicatat setelah dikonfirmasi. */
export default function ReviewScreen() {
  const { t } = useI18n();
  const { show } = useToast();
  const { state } = useStore();
  const slog = useSmartLog();
  const { processNow, saveRule } = slog;
  const [ruleTarget, setRuleTarget] = useState<SmartLogItem | null>(null);
  const [ruleKey, setRuleKey] = useState(0);

  // Antrean di perangkat dibaca dan dikosongkan saat inbox dibuka (sekali pakai, FR-SLOG-4).
  useEffect(() => {
    void processNow();
  }, [processNow]);

  const handleSaveRule = async (input: SmartLogRuleInput) => {
    try {
      await saveRule?.(input);
      show({ tone: 'success', title: t('slog.rules.saved') });
    } catch (e) {
      show({ tone: 'error', title: t('slog.rules.saveFailed') });
      throw e;
    }
  };

  return (
    <Screen onRefresh={slog.status === 'ready' ? () => void slog.processNow().then(slog.reload) : undefined}>
      <ScreenHeader title={t('slog.review.title')} />
      <AppText variant="body" tone="secondary" style={styles.sub}>
        {t('slog.review.sub')}
      </AppText>
      {slog.status === 'error' ? (
        <EmptyState kind="error" title={t('slog.review.loadErrorTitle')} message={t('slog.review.loadErrorMessage')} actionLabel={t('common.retry')} onAction={() => void slog.reload()} />
      ) : slog.status !== 'ready' ? (
        <View style={styles.list} accessibilityLabel={t('slog.review.loading')} aria-busy>
          <Skeleton height={190} radius={radius.lg} />
          <Skeleton height={190} radius={radius.lg} />
        </View>
      ) : (
        <>
          {slog.review.length === 0 ? (
            <EmptyState title={t('slog.review.emptyTitle')} message={t('slog.review.emptyMessage')} />
          ) : (
            <View style={styles.list}>
              {slog.review.map((item) => (
                <ReviewCard
                  key={item.id}
                  item={item}
                  onCreateRule={
                    saveRule
                      ? (target) => {
                          setRuleKey((k) => k + 1);
                          setRuleTarget(target);
                        }
                      : undefined
                  }
                />
              ))}
            </View>
          )}
          {slog.recent.length > 0 && <RecentList items={slog.recent} />}
        </>
      )}
      {saveRule && (
        <RuleSheet
          key={ruleKey}
          visible={!!ruleTarget}
          onClose={() => setRuleTarget(null)}
          accounts={state.accounts}
          initialPattern={ruleTarget?.merchant ?? ''}
          initialAction={ruleTarget?.reasons.includes('topup') ? 'transfer' : 'categorize'}
          onSave={handleSaveRule}
        />
      )}
    </Screen>
  );
}

function ReviewCard({ item, onCreateRule }: { item: SmartLogItem; onCreateRule?: (item: SmartLogItem) => void }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { colors } = useTheme();
  const { show } = useToast();
  const { state } = useStore();
  const { confirm, dismiss, rules } = useSmartLog();
  const [busy, setBusy] = useState<'confirm' | 'dismiss' | null>(null);
  const account = state.accounts.find((a) => a.id === item.accountId);
  const app = smartLogApp(item.pkg)?.app ?? getBank(item.bank).name;

  const run = async (kind: 'confirm' | 'dismiss') => {
    setBusy(kind);
    try {
      if (kind === 'confirm') await confirm(item, draftFromItem(item, rules ?? []));
      else await dismiss(item);
      show({ tone: 'success', title: kind === 'confirm' ? t('slog.review.confirmed') : t('slog.review.dismissed') });
    } catch {
      show({ tone: 'error', title: t('slog.review.failed') });
      setBusy(null);
    }
  };

  return (
    <Card>
      <View style={styles.cardHead}>
        <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
          {`${app} · ${dayLabel(item.date, lang)}, ${item.time.replace(':', '.')}`}
        </AppText>
      </View>
      <CurrencyText amount={item.amount} currency={item.currency} kind={item.type === 'income' ? 'income' : 'expense'} variant="amount" />
      <AppText variant="bodyStrong" numberOfLines={2}>
        {item.merchant || getBank(item.bank).name}
      </AppText>
      {account && (
        <AppText variant="caption" tone="muted">
          {`${account.name} · ${account.currency}`}
        </AppText>
      )}

      <View style={styles.reasons}>
        {item.reasons.map((r) => (
          <View key={r} style={styles.reason}>
            <Icon icon={CircleHelp} color={colors.warning} size={16} />
            <AppText variant="caption" tone="secondary" style={styles.flex}>
              {t(`slog.review.reason.${r}`)}
            </AppText>
          </View>
        ))}
      </View>

      {item.excerpt && (
        <View style={[styles.excerpt, { borderColor: colors.border }]}>
          <AppText variant="caption" tone="muted">
            {t('slog.review.original')}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={4}>
            {item.excerpt}
          </AppText>
        </View>
      )}

      <View style={styles.actions}>
        {account ? (
          <Button label={t('slog.review.confirm')} size="md" loading={busy === 'confirm'} disabled={!!busy} onPress={() => void run('confirm')} />
        ) : null}
        <Button label={t('slog.review.edit')} variant="secondary" size="md" disabled={!!busy} onPress={() => router.push({ pathname: '/otomasi/catat', params: { id: item.id } })} />
        {onCreateRule && item.type === 'expense' && (
          <Button label={t('slog.rules.fromReview')} variant="ghost" size="md" disabled={!!busy} onPress={() => onCreateRule(item)} />
        )}
        <Button label={t('slog.review.dismiss')} variant="ghost" size="md" loading={busy === 'dismiss'} disabled={!!busy} onPress={() => void run('dismiss')} />
      </View>
      {!account && (
        <AppText variant="caption" tone="muted">
          {t('slog.review.needsAccount')}
        </AppText>
      )}
    </Card>
  );
}

function RecentList({ items }: { items: SmartLogItem[] }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { undo } = useSmartLog();
  const { colors } = useTheme();
  const { show } = useToast();
  const [undoing, setUndoing] = useState<string | null>(null);

  const handleUndo = async (id: string) => {
    if (undoing) return;
    setUndoing(id);
    try {
      await undo(id);
    } catch {
      show({ tone: 'error', title: t('slog.review.failed') });
    } finally {
      setUndoing(null);
    }
  };

  return (
    <Group label={t('slog.review.recentTitle')}>
      <Card padding="md">
        {items.map((item, i) => (
          <View key={item.id} style={styles.recentRow}>
            <ListItem
              title={item.merchant || getBank(item.bank).name}
              subtitle={`${getBank(item.bank).name} · ${dayLabel(item.date, lang)}, ${item.time.replace(':', '.')}`}
              trailing={<CurrencyText amount={item.amount} currency={item.currency} kind={item.type === 'income' ? 'income' : 'expense'} variant="bodyStrong" />}
              divider={false}
            />
            <View style={styles.recentActions}>
              <Button label={t('slog.review.undo')} variant="secondary" size="md" loading={undoing === item.id} disabled={undoing !== null} onPress={() => void handleUndo(item.id)} />
              <Button label={t('slog.toast.edit')} variant="ghost" size="md" disabled={undoing !== null} onPress={() => router.push({ pathname: '/tambah', params: { id: item.id } })} />
            </View>
            {i < items.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
          </View>
        ))}
      </Card>
    </Group>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  sub: { paddingHorizontal: space.xs, marginTop: -space.sm },
  flex: { flex: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  reasons: { gap: space.xs, marginTop: space.md },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  excerpt: { marginTop: space.md, padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: space.xxs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg, marginBottom: space.xs },
  recentRow: { gap: space.xs },
  recentActions: { flexDirection: 'row', gap: space.sm, paddingBottom: space.sm },
  divider: { height: StyleSheet.hairlineWidth },
});
