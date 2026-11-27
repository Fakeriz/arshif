import { Megaphone, Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Badge, Button, Chip, Dialog, EmptyState, Input, ListItem, ListItemSkeleton, ProgressBar } from '@/components/ui';
import { adminUserDetail, type AdminUserDetail, type AdminUserRow } from '@/data/remote/api';
import { FnError, invokeFn } from '@/data/remote/functions';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AdminUserResponse, FUNCTIONS } from '../../../supabase/functions/_shared/contracts';
import { downloadCsv, searchAdminUsers } from './adminApi';
import { copy } from './copy';
import { addDaysIso, ago, date, daysRemaining, num } from './format';
import {
  CopyChip,
  DataState,
  HeroInkPanel,
  Panel,
  ProportionBar,
  Refreshing,
  Rows,
  SectionToolbar,
  useLoad,
  type AdminNavigate,
} from './parts';

const c = copy.users;
type CohortFilter = 'all' | 'premium' | 'free' | 'suspended' | 'admin';
type SortMode = 'lastSeen' | 'created' | 'premiumUntil';
const PRESET_DAYS = [7, 30, 90, 365] as const;

function initialsFor(email: string, name: string | null): string {
  const src = (name?.trim() || email).replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return src.slice(0, 2).toUpperCase() || 'AR';
}

/** FR-ADM-2: cari pengguna, filter kohort, lihat paket + kuota, grant/cabut Pro manual, tangguhkan. */
export function UsersSection({
  initialUserId,
  initialQuery,
  onNavigate,
}: {
  initialUserId?: string;
  initialQuery?: string;
  onNavigate?: AdminNavigate;
}) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [debounced, setDebounced] = useState((initialQuery ?? '').trim());
  const [selected, setSelected] = useState<string | null>(initialUserId ?? null);
  const [filter, setFilter] = useState<CohortFilter>('all');
  const [sort, setSort] = useState<SortMode>('lastSeen');
  const [csvNotice, setCsvNotice] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const wide = width >= 860;

  useEffect(() => {
    if (initialQuery !== undefined) {
      setQuery(initialQuery);
      setDebounced(initialQuery.trim());
    }
  }, [initialQuery]);

  useEffect(() => {
    if (initialUserId) setSelected(initialUserId);
  }, [initialUserId]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 260);
    return () => clearTimeout(id);
  }, [query]);

  const list = useLoad(() => searchAdminUsers(debounced, 200), [debounced]);

  const counts = useMemo(() => {
    const rows = list.data ?? [];
    return {
      all: rows.length,
      premium: rows.filter((u) => u.plan === 'premium').length,
      free: rows.filter((u) => u.plan === 'free').length,
      suspended: rows.filter((u) => Boolean(u.suspended_at)).length,
      admin: rows.filter((u) => u.is_admin).length,
    };
  }, [list.data]);

  const filteredRows = useMemo(() => {
    const rows = list.data ?? [];
    const subset = rows.filter((u) => {
      if (filter === 'premium') return u.plan === 'premium';
      if (filter === 'free') return u.plan === 'free';
      if (filter === 'suspended') return Boolean(u.suspended_at);
      if (filter === 'admin') return u.is_admin;
      return true;
    });
    return [...subset].sort((a, b) => {
      if (sort === 'created') return Date.parse(b.created_at) - Date.parse(a.created_at);
      if (sort === 'premiumUntil') {
        const pa = a.premium_until ? Date.parse(a.premium_until) : 0;
        const pb = b.premium_until ? Date.parse(b.premium_until) : 0;
        return pb - pa;
      }
      const la = Date.parse(a.last_seen_at ?? a.created_at);
      const lb = Date.parse(b.last_seen_at ?? b.created_at);
      return lb - la;
    });
  }, [list.data, filter, sort]);

  const exportCsv = () => {
    if (filteredRows.length === 0) return;
    const headers = ['email', 'display_name', 'plan', 'premium_until', 'premium_source', 'suspended_at', 'last_seen_at', 'created_at', 'is_admin', 'id'];
    const rows = filteredRows.map((u: AdminUserRow) => [
      u.email,
      u.display_name,
      u.plan,
      u.premium_until,
      u.premium_source,
      u.suspended_at,
      u.last_seen_at,
      u.created_at,
      u.is_admin ? 'true' : 'false',
      u.id,
    ]);
    downloadCsv('arshif-pengguna.csv', headers, rows);
    setCsvNotice(copy.exportedCsv(filteredRows.length));
  };

  const listView = (
    <View style={styles.gap}>
      <Input label={c.search} value={query} onChangeText={setQuery} icon={Search} autoCapitalize="none" autoCorrect={false} hint={c.searchHint} />

      <SectionToolbar
        left={
          <View style={styles.chips}>
            {(['all', 'premium', 'free', 'suspended', 'admin'] as CohortFilter[]).map((fKey) => (
              <Chip key={fKey} label={c.filters[fKey]} count={counts[fKey]} selected={filter === fKey} onPress={() => setFilter(fKey)} />
            ))}
          </View>
        }
        updatedAt={list.updatedAt}
        loading={list.loading && list.data !== null}
        onReload={list.reload}
        onExportCsv={exportCsv}
        exportDisabled={filteredRows.length === 0}
      />

      <View style={styles.sortRow}>
        <AppText variant="caption" tone="secondary">
          {c.sortLabel}
        </AppText>
        <View style={styles.chips}>
          {(['lastSeen', 'created', 'premiumUntil'] as SortMode[]).map((sKey) => (
            <Chip key={sKey} label={c.sort[sKey]} selected={sort === sKey} onPress={() => setSort(sKey)} />
          ))}
        </View>
      </View>

      {csvNotice && (
        <AppText variant="caption" tone="positive" accessibilityRole="alert">
          {csvNotice}
        </AppText>
      )}

      <Panel title={list.data ? c.count(filteredRows.length) : undefined} right={<Refreshing on={list.loading && list.data !== null} />} padding="md">
        <DataState
          load={list}
          loadingLabel={c.loading}
          errorTitle={c.error}
          skeleton={
            <View>
              <ListItemSkeleton divider />
              <ListItemSkeleton divider />
              <ListItemSkeleton />
            </View>
          }
          isEmpty={() => filteredRows.length === 0}
          empty={<EmptyState compact title={filter === 'all' ? c.empty(debounced) : c.emptyFilter} />}
        >
          {() => (
            <View>
              {filteredRows.map((u, i) => (
                <View key={u.id} style={selected === u.id && wide ? [styles.selected, { backgroundColor: colors.accentSoft }] : undefined}>
                  <ListItem
                    leading={
                      <View style={[styles.avatarSm, { backgroundColor: colors.fill }]}>
                        <AppText variant="overline" tone="primary">
                          {initialsFor(u.email, u.display_name)}
                        </AppText>
                      </View>
                    }
                    title={u.email}
                    subtitle={[
                      u.display_name,
                      u.plan === 'premium' ? c.premium : c.free,
                      u.suspended_at ? c.suspended : null,
                      u.is_admin ? c.admin : null,
                      u.last_seen_at ? c.lastSeen(ago(u.last_seen_at)) : c.neverSeen,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    trailing={
                      <View style={styles.rowBadges}>
                        <Badge label={u.plan === 'premium' ? c.premium : c.free} tone={u.plan === 'premium' ? 'accent' : 'neutral'} />
                        {u.suspended_at ? <Badge label={c.suspended} tone="negative" /> : null}
                      </View>
                    }
                    onPress={() => setSelected(u.id)}
                    chevron
                    divider={i < filteredRows.length - 1}
                    accessibilityLabel={`${u.email}${selected === u.id ? ', dipilih' : ''}`}
                  />
                </View>
              ))}
            </View>
          )}
        </DataState>
      </Panel>
    </View>
  );

  if (wide) {
    return (
      <View style={styles.split}>
        <View style={styles.listCol}>{listView}</View>
        <View style={styles.detailCol}>
          {selected ? (
            <UserDetail key={selected} userId={selected} onChanged={list.reload} onNavigate={onNavigate} />
          ) : (
            <EmptyState compact title={c.pickTitle} message={c.pickMessage} />
          )}
        </View>
      </View>
    );
  }
  if (selected) {
    return (
      <View style={styles.gap}>
        <Button label={c.back} variant="ghost" size="sm" onPress={() => setSelected(null)} />
        <UserDetail key={selected} userId={selected} onChanged={list.reload} onNavigate={onNavigate} />
      </View>
    );
  }
  return listView;
}

type Notice = { tone: 'positive' | 'negative' | 'info'; text: string } | null;

function UserDetail({
  userId,
  onChanged,
  onNavigate,
}: {
  userId: string;
  onChanged: () => void;
  onNavigate?: AdminNavigate;
}) {
  const load = useLoad(() => adminUserDetail(userId), [userId]);
  return (
    <DataState load={load} loadingLabel={c.loading} errorTitle={c.detailError}>
      {(u) =>
        u ? (
          <DetailBody
            u={u}
            refreshing={load.loading}
            onChanged={() => {
              load.reload();
              onChanged();
            }}
            onNavigate={onNavigate}
          />
        ) : (
          <EmptyState compact kind="error" title={c.detailError} />
        )
      }
    </DataState>
  );
}

function DetailBody({
  u,
  refreshing,
  onChanged,
  onNavigate,
}: {
  u: AdminUserDetail;
  refreshing: boolean;
  onChanged: () => void;
  onNavigate?: AdminNavigate;
}) {
  const { colors } = useTheme();
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState<'grant' | 'revoke' | 'suspend' | null>(null);
  const [confirm, setConfirm] = useState<'revoke' | 'suspend' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const daysNum = Number(days);
  const daysValid = Number.isInteger(daysNum) && daysNum >= 1 && daysNum <= 3660;
  const activeManual = u.orders.some((o) => o.provider === 'manual' && o.status === 'paid' && o.granted_until && Date.parse(o.granted_until) > Date.now());
  const remDays = u.plan === 'premium' ? daysRemaining(u.premium_until) : null;

  const run = async (action: 'grant' | 'revoke' | 'suspend' | 'unsuspend') => {
    setBusy(action === 'unsuspend' ? 'suspend' : action);
    setNotice(null);
    try {
      const body = action === 'grant' ? { action, userId: u.id, days: daysNum } : { action, userId: u.id };
      const r = await invokeFn(FUNCTIONS.adminUser, body, AdminUserResponse);
      if (action === 'grant' && r.grantQueued) {
        setNotice({ tone: 'info', text: c.grantQueued });
        onChanged();
        return;
      }
      const text =
        action === 'grant'
          ? c.granted(r.premiumUntil ? date(r.premiumUntil) : '-')
          : action === 'revoke'
            ? c.revoked(r.plan === 'premium' ? c.premium : c.free)
            : action === 'suspend'
              ? c.suspended_
              : c.unsuspended;
      setNotice({ tone: 'positive', text: !r.revenueCat && action === 'grant' ? `${text} ${c.grantLocal}` : text });
      onChanged();
    } catch (e) {
      setNotice({ tone: 'negative', text: e instanceof FnError && e.code === 'forbidden' && action === 'suspend' ? c.adminLocked : c.actionFailed });
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const rollingQuotas = u.usage.filter((q) => q.window === 'month' || q.window === 'day');
  const totalQuotas = u.usage.filter((q) => q.window === 'total');
  const featureQuotas = u.usage.filter((q) => q.window === 'feature');
  const aiEntries = Object.entries(u.ai_30d);
  const aiTotal30 = aiEntries.reduce((sum, [, n]) => sum + Number(n), 0);

  return (
    <View style={styles.gap}>
      <HeroInkPanel>
        <View style={styles.identityHead}>
          <HeroAvatar initials={initialsFor(u.email, u.display_name)} />
          <View style={styles.flex}>
            <AppText variant="h3" numberOfLines={1}>
              {u.display_name || u.email}
            </AppText>
            <AppText variant="caption" tone="secondary" numberOfLines={1}>
              {u.email}
            </AppText>
          </View>
          <Refreshing on={refreshing} />
        </View>

        <View style={styles.badges}>
          <Badge label={u.plan === 'premium' ? c.premium : c.free} tone={u.plan === 'premium' ? 'positive' : 'neutral'} />
          {remDays !== null && <Badge label={c.daysLeft(remDays)} tone="neutral" />}
          {u.suspended_at && <Badge label={c.suspended} tone="negative" />}
          {u.is_admin && <Badge label={c.admin} tone="info" />}
        </View>

        <View style={styles.facts}>
          {u.plan === 'premium' && (
            <AppText variant="body">
              {[
                u.premium_until ? c.premiumUntil(date(u.premium_until)) : c.premiumNoEnd,
                u.premium_source ? c.source(copy.dashboard.premiumSources[u.premium_source] ?? u.premium_source) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          )}
          <AppText variant="caption" tone="secondary">
            {[
              c.joined(date(u.created_at)),
              u.last_seen_at ? c.lastSeen(ago(u.last_seen_at)) : c.neverSeen,
              u.onboarded ? null : c.notOnboarded,
              `${u.main_currency} · ${u.lang.toUpperCase()}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
          <AppText variant="caption" tone="muted" selectable>
            {u.id}
          </AppText>
        </View>

        <View style={styles.actions}>
          <CopyChip value={u.email} label={c.copyEmail} />
          <CopyChip value={u.id} label={c.copyId} />
          {onNavigate && (
            <Button
              label={c.sendMessage}
              icon={Megaphone}
              variant="secondary"
              size="sm"
              onPress={() => onNavigate({ bagian: 'broadcast', email: u.email })}
            />
          )}
        </View>
      </HeroInkPanel>

      <Panel title={c.grantTitle}>
        <View style={styles.chips}>
          {PRESET_DAYS.map((preset) => (
            <Chip key={preset} label={c.grantPreset(preset)} selected={days === String(preset)} onPress={() => setDays(String(preset))} />
          ))}
        </View>
        <Input label={c.grantDays} value={days} onChangeText={setDays} keyboardType="number-pad" error={days && !daysValid ? c.grantDaysError : undefined} />
        {daysValid && (
          <AppText variant="caption" tone="primary" numeric>
            {c.grantPreview(date(addDaysIso(u.premium_until, daysNum)))}
          </AppText>
        )}
        <AppText variant="caption" tone="secondary">
          {c.grantNote}
        </AppText>
        {notice && (
          <AppText variant="body" tone={notice.tone} accessibilityRole="alert">
            {notice.text}
          </AppText>
        )}
        <View style={styles.actions}>
          <Button label={c.grantSubmit(daysValid ? daysNum : 0)} disabled={!daysValid || busy !== null} loading={busy === 'grant'} onPress={() => void run('grant')} />
          {activeManual && <Button label={c.revokeSubmit} variant="secondary" disabled={busy !== null} loading={busy === 'revoke'} onPress={() => setConfirm('revoke')} />}
          {!u.is_admin &&
            (u.suspended_at ? (
              <Button label={c.unsuspendSubmit} variant="secondary" disabled={busy !== null} loading={busy === 'suspend'} onPress={() => void run('unsuspend')} />
            ) : (
              <Button label={c.suspendSubmit} variant="danger" disabled={busy !== null} loading={busy === 'suspend'} onPress={() => setConfirm('suspend')} />
            ))}
        </View>
      </Panel>

      <Panel title={c.quota}>
        {rollingQuotas.length > 0 && (
          <View style={styles.quotaGroup}>
            <AppText variant="overline" tone="muted">
              {c.quotaGroups.rolling}
            </AppText>
            <Rows>{rollingQuotas.map((q) => <Quota key={q.key} q={q} />)}</Rows>
          </View>
        )}
        {totalQuotas.length > 0 && (
          <View style={styles.quotaGroup}>
            <AppText variant="overline" tone="muted">
              {c.quotaGroups.total}
            </AppText>
            <Rows>{totalQuotas.map((q) => <Quota key={q.key} q={q} />)}</Rows>
          </View>
        )}
        {featureQuotas.length > 0 && (
          <View style={styles.quotaGroup}>
            <AppText variant="overline" tone="muted">
              {c.quotaGroups.feature}
            </AppText>
            <Rows>{featureQuotas.map((q) => <Quota key={q.key} q={q} />)}</Rows>
          </View>
        )}
      </Panel>

      <Panel title={c.ai30} right={aiTotal30 > 0 ? <Badge label={c.ai30Total(num(aiTotal30))} tone="neutral" /> : undefined}>
        {aiEntries.length === 0 ? (
          <AppText variant="body" tone="secondary">
            {c.ai30None}
          </AppText>
        ) : (
          <Rows>
            {aiEntries.map(([k, n]) => (
              <View key={k} style={styles.gapXs}>
                <View style={styles.line}>
                  <AppText variant="body" style={styles.flex}>
                    {copy.ai.kind[k] ?? k}
                  </AppText>
                  <AppText variant="bodyStrong" numeric>
                    {num(Number(n))}
                  </AppText>
                </View>
                <ProportionBar
                  height={6}
                  segments={[
                    { key: k, value: Number(n), color: colors.accent },
                    { key: 'rest', value: Math.max(0, aiTotal30 - Number(n)), color: colors.track },
                  ]}
                />
              </View>
            ))}
          </Rows>
        )}
      </Panel>

      <Panel title={c.orders}>
        {u.orders.length === 0 ? (
          <AppText variant="body" tone="secondary">
            {c.ordersNone}
          </AppText>
        ) : (
          <Rows>
            {u.orders.map((o) => (
              <View key={o.id} style={styles.gapXs}>
                <View style={styles.line}>
                  <AppText variant="bodyStrong" style={styles.flex}>
                    {copy.orders.provider[o.provider] ?? o.provider}
                  </AppText>
                  <Badge label={copy.orders.status[o.status] ?? o.status} tone={o.status === 'paid' ? 'positive' : o.status === 'pending' ? 'warning' : 'neutral'} />
                </View>
                <AppText variant="caption" tone="secondary" numeric>
                  {[
                    date(o.created_at),
                    o.provider === 'manual' ? copy.orders.days(o.days ?? 0) : `${copy.orders.period[o.period] ?? o.period} · ${formatMoney(Number(o.amount), o.currency)}`,
                    o.granted_until ? copy.orders.until(date(o.granted_until)) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
                <View style={styles.line}>
                  <CopyChip value={o.id} label={o.id.slice(0, 8)} accessibilityLabel={`${c.copyId} ${o.id}`} />
                </View>
              </View>
            ))}
          </Rows>
        )}
      </Panel>

      <Dialog
        visible={confirm === 'revoke'}
        title={c.revokeConfirmTitle}
        message={c.revokeConfirm(u.email)}
        tone="warning"
        confirmLabel={c.revokeSubmit}
        cancelLabel={c.cancel}
        loading={busy === 'revoke'}
        onConfirm={() => void run('revoke')}
        onCancel={() => setConfirm(null)}
      />
      <Dialog
        visible={confirm === 'suspend'}
        title={c.suspendConfirmTitle}
        message={c.suspendConfirm(u.email)}
        tone="danger"
        confirmLabel={c.suspendSubmit}
        cancelLabel={c.cancel}
        loading={busy === 'suspend'}
        onConfirm={() => void run('suspend')}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}

function HeroAvatar({ initials }: { initials: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.avatarLgWrap, { backgroundColor: colors.fill }]}>
      <AppText variant="bodyStrong">{initials}</AppText>
    </View>
  );
}

function Quota({ q }: { q: AdminUserDetail['usage'][number] }) {
  const label = c.quotaLabels[q.key] ?? q.key;
  if (q.window === 'feature') {
    const enabled = q.limit !== 0;
    return (
      <View style={styles.line}>
        <AppText variant="body" style={styles.flex}>
          {label}
        </AppText>
        <Badge label={enabled ? c.quotaFeatureOn : c.quotaFeatureOff} tone={enabled ? 'positive' : 'neutral'} />
      </View>
    );
  }
  const unlimited = q.limit === null;
  return (
    <View style={styles.gapXs}>
      <View style={styles.line}>
        <AppText variant="body" style={styles.flex}>
          {label}
        </AppText>
        <AppText variant="caption" tone="secondary" numeric>
          {`${num(q.used)} / ${unlimited ? c.quotaUnlimited : num(q.limit ?? 0)} ${c.quotaWindow[q.window] ?? ''}`}
        </AppText>
      </View>
      {!unlimited && (q.limit ?? 0) > 0 && <ProgressBar value={Math.min(1, q.used / (q.limit ?? 1))} />}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.lg },
  gapXs: { gap: space.xs },
  split: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  listCol: { flex: 2, minWidth: 0 },
  detailCol: { flex: 3, minWidth: 0 },
  selected: { borderRadius: radius.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  avatarSm: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLgWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  rowBadges: {
    flexDirection: 'row',
    gap: space.xs,
    alignItems: 'center',
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  facts: { gap: space.xxs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  quotaGroup: { gap: space.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
