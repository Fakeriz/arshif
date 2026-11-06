import { Pause, Pencil, Play, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Card, CategoryIcon, Dialog, EmptyState, ListItem, useToast } from '@/components/ui';
import type { Subscription } from '@/data/planning';
import { SubscriptionForm } from '@/features/planning/forms';
import { AddButton, PlanScreen, SectionLabel, useSaveError } from '@/features/planning/kit';
import { InfoRow } from '@/features/transactions/InfoRow';
import { useI18n } from '@/i18n';
import { shortDate } from '@/lib/dates';
import { convert, hasRate } from '@/lib/fx';
import { formatMoney } from '@/lib/money';
import { subscriptionTotals } from '@/lib/planning/subscriptions';
import { useStore } from '@/state/AppStore';
import { useLimits } from '@/state/limits';
import { usePlanning } from '@/state/planning';
import { space } from '@/theme/tokens';

const toMain = (minor: number, from: string, to: string): number | null => (from === to ? minor : hasRate(from) && hasRate(to) ? convert(minor, from, to) : null);

export default function SubscriptionsScreen() {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const { subscriptions } = usePlanning();
  const limits = useLimits();
  const [form, setForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const main = state.mainCurrency;
  const active = subscriptions.filter((s) => s.status === 'active');
  const stopped = subscriptions.filter((s) => s.status === 'cancelled');
  const totals = subscriptionTotals(subscriptions, main, toMain);
  const open = subscriptions.find((s) => s.id === openId) ?? null;

  const row = (s: Subscription, i: number, list: Subscription[]) => {
    const converted = s.currency !== main ? toMain(s.amount, s.currency, main) : null;
    return (
      <ListItem
        key={s.id}
        leading={<CategoryIcon category={s.categoryKey} size={36} />}
        title={s.name}
        subtitle={s.status === 'active' ? t('plan.subs.renews', { date: shortDate(s.nextRenewal, lang) }) : t(`plan.subs.cycles.${s.cycle}`)}
        trailing={
          <View style={styles.trailing}>
            <AppText variant="bodyStrong" numeric>
              {`${formatMoney(s.amount, s.currency)}${t(`plan.subs.perCycle.${s.cycle}`)}`}
            </AppText>
            {converted !== null && (
              <AppText variant="caption" tone="muted" numeric>
                {t('plan.common.convertedNote', { amount: formatMoney(converted, main) })}
              </AppText>
            )}
          </View>
        }
        onPress={() => setOpenId(s.id)}
        divider={i < list.length - 1}
      />
    );
  };

  return (
    <PlanScreen
      title={t('plan.subs.title')}
      right={subscriptions.length ? <AddButton label={t('plan.common.add')} limited={limits.subscriptions} reason={t('plan.subs.limitReason')} onPress={() => setForm(true)} /> : undefined}
    >
      {subscriptions.length === 0 ? (
        <EmptyState title={t('plan.subs.emptyTitle')} message={t('plan.subs.emptyMessage')} actionLabel={t('plan.subs.create')} onAction={() => setForm(true)} />
      ) : (
        <>
          <Card>
            <View style={styles.totals}>
              <View style={styles.total}>
                <AppText variant="caption" tone="secondary">
                  {t('plan.subs.perMonth')}
                </AppText>
                <AppText variant="h2" numeric>
                  {formatMoney(totals.monthly, main)}
                </AppText>
              </View>
              <View style={styles.total}>
                <AppText variant="caption" tone="secondary">
                  {t('plan.subs.perYear')}
                </AppText>
                <AppText variant="h2" numeric>
                  {formatMoney(totals.yearly, main)}
                </AppText>
              </View>
            </View>
            {state.ratesDate && active.some((s) => s.currency !== main) && (
              <AppText variant="caption" tone="muted" style={styles.note}>
                {t('plan.subs.totalsNote', { currency: main, date: shortDate(state.ratesDate, lang) })}
              </AppText>
            )}
            {totals.missing.length > 0 && (
              <AppText variant="caption" tone="warning" style={styles.note}>
                {t('plan.subs.totalsNoRate', { codes: totals.missing.join(', ') })}
              </AppText>
            )}
          </Card>
          {active.length > 0 && <Card padding="sm">{active.map(row)}</Card>}
          {stopped.length > 0 && <SectionLabel>{t('plan.subs.stoppedSection')}</SectionLabel>}
          {stopped.length > 0 && <Card padding="sm">{stopped.map(row)}</Card>}
        </>
      )}
      <SubscriptionForm key={form ? 'open' : 'closed'} visible={form} onClose={() => setForm(false)} />
      <SubscriptionSheet sub={open} onClose={() => setOpenId(null)} />
    </PlanScreen>
  );
}

function SubscriptionSheet({ sub, onClose }: { sub: Subscription | null; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { show } = useToast();
  const { setSubStatus, removeSub } = usePlanning();
  const saveError = useSaveError();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!sub) return null;
  const toggle = async () => {
    setBusy(true);
    try {
      await setSubStatus(sub.id, sub.status === 'active' ? 'cancelled' : 'active');
      onClose();
    } catch (e) {
      saveError(e, t('plan.subs.limitReason'), onClose);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <BottomSheet scrollable visible={!edit && !confirm} onClose={onClose} title={sub.name} subtitle={`${formatMoney(sub.amount, sub.currency)}${t(`plan.subs.perCycle.${sub.cycle}`)}`}>
        <InfoRow label={t('plan.subs.nextRenewal')} value={sub.status === 'active' ? shortDate(sub.nextRenewal, lang) : t('plan.subs.stopped')} divider />
        <InfoRow label={t('plan.subs.cycle')} value={t(`plan.subs.cycles.${sub.cycle}`)} />
        <View style={styles.actions}>
          <Button label={sub.status === 'active' ? t('plan.subs.stop') : t('plan.subs.resume')} icon={sub.status === 'active' ? Pause : Play} variant="secondary" fullWidth loading={busy} onPress={() => void toggle()} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button label={t('plan.common.edit')} icon={Pencil} variant="secondary" fullWidth onPress={() => setEdit(true)} />
            </View>
            <View style={styles.flex}>
              <Button label={t('plan.common.delete')} icon={Trash2} variant="danger" fullWidth onPress={() => setConfirm(true)} />
            </View>
          </View>
        </View>
      </BottomSheet>
      <SubscriptionForm key={edit ? `edit-${sub.id}` : 'closed'} visible={edit} onClose={() => { setEdit(false); onClose(); }} sub={sub} />
      <Dialog
        visible={confirm}
        tone="danger"
        title={t('plan.common.deleteTitle', { name: sub.name })}
        message={t('plan.common.deleteMessage')}
        confirmLabel={t('plan.common.delete')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          removeSub(sub.id)
            .then(() => {
              onClose();
              show({ tone: 'success', title: t('plan.common.deleted') });
            })
            .catch(() => show({ tone: 'error', title: t('plan.common.deleteFailed') }));
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', gap: space.lg },
  total: { flex: 1, gap: space.xxs },
  note: { marginTop: space.sm },
  trailing: { alignItems: 'flex-end', gap: space.xxs },
  actions: { gap: space.sm, marginTop: space.lg },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});
