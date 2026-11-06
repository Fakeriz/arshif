import { Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Badge, Button, Dialog, EmptyState, Input, ListItem, ListItemSkeleton, ProgressBar } from '@/components/ui';
import { adminSearchUsers, adminUserDetail, type AdminUserDetail } from '@/data/remote/api';
import { FnError, invokeFn } from '@/data/remote/functions';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AdminUserResponse, FUNCTIONS } from '../../../supabase/functions/_shared/contracts';
import { copy } from './copy';
import { ago, date, num } from './format';
import { DataState, Panel, Refreshing, Rows, useLoad } from './parts';

const c = copy.users;

/** FR-ADM-2: cari pengguna, lihat paket + kuota, grant/cabut Premium manual, tangguhkan. */
export function UsersSection() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const wide = width >= 860;

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);
  const list = useLoad(() => adminSearchUsers(debounced), [debounced]);

  const listView = (
    <View style={styles.gap}>
      <Input label={c.search} value={query} onChangeText={setQuery} icon={Search} autoCapitalize="none" autoCorrect={false} hint={c.searchHint} />
      <Panel title={list.data ? c.count(list.data.length) : undefined} right={<Refreshing on={list.loading && list.data !== null} />} padding="md">
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
          isEmpty={(rows) => rows.length === 0}
          empty={<EmptyState compact title={c.empty(debounced)} />}
        >
          {(rows) => (
            <View>
              {rows.map((u, i) => (
                <View key={u.id} style={selected === u.id && wide ? [styles.selected, { backgroundColor: colors.accentSoft }] : undefined}>
                  <ListItem
                    title={u.email}
                    subtitle={[u.plan === 'premium' ? c.premium : c.free, u.suspended_at ? c.suspended : null, u.is_admin ? c.admin : null, u.last_seen_at ? c.lastSeen(ago(u.last_seen_at)) : c.neverSeen]
                      .filter(Boolean)
                      .join(' · ')}
                    onPress={() => setSelected(u.id)}
                    chevron
                    divider={i < rows.length - 1}
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
          {selected ? <UserDetail key={selected} userId={selected} onChanged={list.reload} /> : <EmptyState compact title={c.pickTitle} message={c.pickMessage} />}
        </View>
      </View>
    );
  }
  if (selected) {
    return (
      <View style={styles.gap}>
        <Button label={c.back} variant="ghost" size="sm" onPress={() => setSelected(null)} />
        <UserDetail key={selected} userId={selected} onChanged={list.reload} />
      </View>
    );
  }
  return listView;
}

type Notice = { tone: 'positive' | 'negative' | 'info'; text: string } | null;

function UserDetail({ userId, onChanged }: { userId: string; onChanged: () => void }) {
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
          />
        ) : (
          <EmptyState compact kind="error" title={c.detailError} />
        )
      }
    </DataState>
  );
}

function DetailBody({ u, refreshing, onChanged }: { u: AdminUserDetail; refreshing: boolean; onChanged: () => void }) {
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState<'grant' | 'revoke' | 'suspend' | null>(null);
  const [confirm, setConfirm] = useState<'revoke' | 'suspend' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const daysNum = Number(days);
  const daysValid = Number.isInteger(daysNum) && daysNum >= 1 && daysNum <= 3660;
  const activeManual = u.orders.some((o) => o.provider === 'manual' && o.status === 'paid' && o.granted_until && Date.parse(o.granted_until) > Date.now());

  const run = async (action: 'grant' | 'revoke' | 'suspend' | 'unsuspend') => {
    setBusy(action === 'unsuspend' ? 'suspend' : action);
    setNotice(null);
    try {
      const body = action === 'grant' ? { action, userId: u.id, days: daysNum } : { action, userId: u.id };
      const r = await invokeFn(FUNCTIONS.adminUser, body, AdminUserResponse);
      const text =
        action === 'grant' ? c.granted(r.premiumUntil ? date(r.premiumUntil) : '-') : action === 'revoke' ? c.revoked(r.plan === 'premium' ? c.premium : c.free) : action === 'suspend' ? c.suspended_ : c.unsuspended;
      setNotice({ tone: 'positive', text: !r.revenueCat && action === 'grant' ? `${text} ${c.grantLocal}` : text });
      onChanged();
    } catch (e) {
      setNotice({ tone: 'negative', text: e instanceof FnError && e.code === 'forbidden' && action === 'suspend' ? c.adminLocked : c.actionFailed });
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  return (
    <View style={styles.gap}>
      <Panel title={u.email} right={<Refreshing on={refreshing} />}>
        <View style={styles.badges}>
          <Badge label={u.plan === 'premium' ? c.premium : c.free} tone={u.plan === 'premium' ? 'accent' : 'neutral'} />
          {u.suspended_at && <Badge label={c.suspended} tone="negative" />}
          {u.is_admin && <Badge label={c.admin} tone="info" />}
        </View>
        <View style={styles.facts}>
          {u.display_name ? <AppText variant="body">{u.display_name}</AppText> : null}
          {u.plan === 'premium' && (
            <AppText variant="body">
              {[u.premium_until ? c.premiumUntil(date(u.premium_until)) : c.premiumNoEnd, u.premium_source ? c.source(copy.dashboard.premiumSources[u.premium_source] ?? u.premium_source) : null]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          )}
          <AppText variant="caption" tone="secondary">
            {[c.joined(date(u.created_at)), u.last_seen_at ? c.lastSeen(ago(u.last_seen_at)) : c.neverSeen, u.onboarded ? null : c.notOnboarded, `${u.main_currency} · ${u.lang.toUpperCase()}`]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
          <AppText variant="caption" tone="muted" selectable>
            {u.id}
          </AppText>
        </View>
      </Panel>

      <Panel title={c.grantTitle}>
        <Input label={c.grantDays} value={days} onChangeText={setDays} keyboardType="number-pad" error={days && !daysValid ? c.grantDaysError : undefined} />
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
        <Rows>
          {u.usage.map((q) => (
            <Quota key={q.key} q={q} />
          ))}
        </Rows>
      </Panel>

      <Panel title={c.ai30}>
        {Object.keys(u.ai_30d).length === 0 ? (
          <AppText variant="body" tone="secondary">
            {c.ai30None}
          </AppText>
        ) : (
          <AppText variant="body">
            {Object.entries(u.ai_30d)
              .map(([k, n]) => `${copy.ai.kind[k] ?? k}: ${num(n)}`)
              .join(' · ')}
          </AppText>
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
                <AppText variant="caption" tone="secondary">
                  {[date(o.created_at), o.provider === 'manual' ? copy.orders.days(o.days ?? 0) : `${copy.orders.period[o.period] ?? o.period} · ${formatMoney(Number(o.amount), o.currency)}`, o.granted_until ? copy.orders.until(date(o.granted_until)) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
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

function Quota({ q }: { q: AdminUserDetail['usage'][number] }) {
  const label = c.quotaLabels[q.key] ?? q.key;
  if (q.window === 'feature') {
    return (
      <View style={styles.line}>
        <AppText variant="body" style={styles.flex}>
          {label}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {q.limit === 0 ? c.quotaFeatureOff : c.quotaFeatureOn}
        </AppText>
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
  gapXs: { gap: space.xxs },
  split: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  listCol: { flex: 2, minWidth: 0 },
  detailCol: { flex: 3, minWidth: 0 },
  // Baris terpilih di daftar (tata letak lebar): detailnya tampil di kolom kanan.
  selected: { borderRadius: radius.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  facts: { gap: space.xxs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
