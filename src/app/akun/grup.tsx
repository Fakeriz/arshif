import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AmountField, AppText, Button, Card, Checkbox, Chip, Dialog, EmptyState, Input, ListItem, Skeleton } from '@/components/ui';
import type { LimitGroup } from '@/data/types';
import { UtilizationBlock } from '@/features/accounts/UtilizationBlock';
import { FormSheet } from '@/features/planning/kit';
import { bankName, useT } from '@/i18n';
import { groupUtilization, isCreditType } from '@/lib/credit';
import { newId } from '@/lib/uuid';
import { useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';
import { useLoadState } from '@/state/loadState';
import { useRetry } from '@/state/useRetry';
import { radius, space } from '@/theme/tokens';

/**
 * Grup limit gabungan (FR-ACC-6): beberapa kartu dari satu bank berbagi satu limit. Utilisasi grup =
 * total terpakai semua kartu di grup ÷ limit gabungan. Kartu di luar grup tetap memakai limit sendiri.
 */
export default function LimitGroups() {
  const t = useT();
  const load = useLoadState();
  const retry = useRetry();
  const { state, dispatch } = useStore();
  const { accounts } = useLedger();
  const cards = accounts.filter((a) => isCreditType(a.type));
  const [editing, setEditing] = useState<LimitGroup | 'new' | null>(null);
  const [deleting, setDeleting] = useState<LimitGroup | null>(null);

  let body;
  if (load === 'error') {
    body = <EmptyState kind="error" title={t('acct.common.loadErrorTitle')} message={t('acct.common.loadErrorMessage')} actionLabel={t('common.retry')} onAction={retry} />;
  } else if (load === 'loading') {
    body = (
      <View style={styles.list} accessibilityLabel={t('acct.common.loading')} aria-busy>
        <Skeleton height={140} radius={radius.lg} />
        <Skeleton height={140} radius={radius.lg} />
      </View>
    );
  } else if (cards.length < 2) {
    body = <EmptyState title={t('acct.group.needCardsTitle')} message={t('acct.group.needCardsMessage', { count: cards.length })} />;
  } else if (state.limitGroups.length === 0) {
    body = <EmptyState title={t('acct.group.emptyTitle')} message={t('acct.group.emptyMessage')} actionLabel={t('acct.group.create')} onAction={() => setEditing('new')} />;
  } else {
    body = (
      <View style={styles.list}>
        {state.limitGroups.map((g) => {
          const members = accounts.filter((a) => a.limitGroupId === g.id);
          return (
            <Card key={g.id} onPress={() => setEditing(g)} accessibilityLabel={t('acct.group.editA11y', { name: g.name })}>
              <AppText variant="h3">{g.name}</AppText>
              <AppText variant="caption" tone="secondary" numberOfLines={2}>
                {members.length ? members.map((a) => a.name).join(' · ') : t('acct.group.noMembers')}
              </AppText>
              <View style={styles.gap}>
                <UtilizationBlock u={groupUtilization(g, accounts)} compact />
              </View>
              {members.length < 2 && (
                <AppText variant="caption" tone="warning">
                  {t('acct.group.tooFew')}
                </AppText>
              )}
            </Card>
          );
        })}
      </View>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={t('acct.group.title')}
        right={load === 'ready' && cards.length >= 2 && state.limitGroups.length > 0 ? <Button label={t('acct.group.add')} icon={Plus} size="sm" variant="secondary" onPress={() => setEditing('new')} /> : undefined}
      />
      <AppText variant="caption" tone="secondary">
        {t('acct.group.explain')}
      </AppText>
      {body}
      <GroupSheet
        key={editing === null ? 'closed' : editing === 'new' ? 'new' : editing.id}
        group={editing === 'new' ? null : editing}
        visible={editing !== null}
        cards={cards.map((a) => ({ id: a.id, name: a.name, bank: bankName(t, a.bank), currency: a.currency, inGroup: a.limitGroupId ?? null }))}
        mainCurrency={state.mainCurrency}
        onClose={() => setEditing(null)}
        onSave={(group, members) => {
          dispatch({ type: editing === 'new' ? 'limitGroup/add' : 'limitGroup/update', group, members });
          setEditing(null);
        }}
        onDelete={(g) => {
          setEditing(null);
          setDeleting(g);
        }}
      />
      <Dialog
        visible={deleting !== null}
        tone="danger"
        title={t('acct.group.deleteTitle', { name: deleting?.name ?? '' })}
        message={t('acct.group.deleteMessage')}
        confirmLabel={t('acct.group.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) dispatch({ type: 'limitGroup/delete', id: deleting.id });
          setDeleting(null);
        }}
      />
    </Screen>
  );
}

type CardOption = { id: string; name: string; bank: string; currency: string; inGroup: string | null };

function GroupSheet({ group, visible, cards, mainCurrency, onClose, onSave, onDelete }: {
  group: LimitGroup | null; visible: boolean; cards: CardOption[]; mainCurrency: string; onClose: () => void;
  onSave: (g: LimitGroup, members: string[]) => void; onDelete: (g: LimitGroup) => void;
}) {
  const t = useT();
  const [name, setName] = useState(group?.name ?? '');
  const [members, setMembers] = useState<string[]>(group ? cards.filter((c) => c.inGroup === group.id).map((c) => c.id) : []);
  const currencies = [...new Set([...(group ? [group.currency] : []), ...cards.map((c) => c.currency), mainCurrency])];
  const [currency, setCurrency] = useState(group?.currency ?? cards[0]?.currency ?? mainCurrency);
  const [limit, setLimit] = useState<number | null>(group?.sharedLimit ?? null);
  const [tried, setTried] = useState(false);
  const nameOk = name.trim().length > 0;
  const limitOk = !!limit && limit > 0;
  const membersOk = members.length >= 2;

  const submit = () => {
    setTried(true);
    if (!nameOk || !limitOk || !membersOk) return;
    onSave({ id: group?.id ?? newId(), name: name.trim(), currency, sharedLimit: limit! }, members);
  };

  return (
    <FormSheet visible={visible} onClose={onClose} title={group ? t('acct.group.editTitle') : t('acct.group.create')} subtitle={t('acct.group.sheetSub')} submitLabel={t('acct.common.save')} saving={false} onSubmit={submit}>
      <Input label={t('acct.group.name')} placeholder={t('acct.group.namePlaceholder')} value={name} onChangeText={setName} maxLength={60} error={tried && !nameOk ? t('acct.group.nameError') : undefined} />
      <View style={styles.block}>
        <AppText variant="caption" tone="secondary">
          {t('acct.group.currency')}
        </AppText>
        <View style={styles.chips}>
          {currencies.map((c) => (
            <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />
          ))}
        </View>
      </View>
      <AmountField label={`${t('acct.group.limit')} (${currency})`} value={limit} onChange={setLimit} currency={currency} error={tried && !limitOk ? t('acct.group.limitError') : undefined} />
      <View style={styles.block}>
        <AppText variant="caption" tone="secondary">
          {t('acct.group.members')}
        </AppText>
        {cards.map((c) => {
          const elsewhere = c.inGroup !== null && c.inGroup !== group?.id;
          return (
            <ListItem
              key={c.id}
              title={c.name}
              subtitle={elsewhere ? t('acct.group.movesHere') : c.currency !== currency ? t('acct.group.converted', { code: c.currency }) : c.bank}
              subtitleLines={2}
              trailing={
                <Checkbox
                  accessibilityLabel={c.name}
                  checked={members.includes(c.id)}
                  onChange={(on) => setMembers((m) => (on ? [...m, c.id] : m.filter((x) => x !== c.id)))}
                />
              }
            />
          );
        })}
        {tried && !membersOk && (
          <AppText variant="caption" tone="negative">
            {t('acct.group.membersError')}
          </AppText>
        )}
      </View>
      {group && <Button label={t('acct.group.delete')} variant="ghost" size="md" fullWidth onPress={() => onDelete(group)} />}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  gap: { marginTop: space.md },
  block: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
