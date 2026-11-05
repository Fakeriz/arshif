import { RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Badge, Button, Card, Chip, EmptyState, Input, Skeleton, Tabs } from '@/components/ui';
import { adminAiFailures, adminAiUsage, adminOrders, isAdmin, type AdminOrder, type AiFailure, type AiUsageRow, type OrderStatus } from '@/data/remote/api';
import { FnError, invokeFn } from '@/data/remote/functions';
import { useI18n } from '@/i18n';
import { isoDateLabel, isoDateTimeLabel } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { AdminGrantRequest, AdminGrantResponse, FUNCTIONS } from '../../supabase/functions/_shared/contracts';

type Section = 'orders' | 'grant' | 'ai';
const STATUSES: OrderStatus[] = ['pending', 'paid', 'expired', 'failed', 'refunded'];
const TONE: Record<OrderStatus, 'warning' | 'positive' | 'neutral' | 'negative' | 'info'> = {
  pending: 'warning', paid: 'positive', expired: 'neutral', failed: 'negative', refunded: 'info',
};

/**
 * Panel admin (FR-ADM-3/4): pesanan web, grant Premium manual, pemakaian AI. Hanya web dan hanya role admin;
 * server menolak RPC/function admin untuk pengguna lain, layar ini hanya tidak menampilkannya.
 */
export default function AdminScreen() {
  const { t } = useI18n();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [section, setSection] = useState<Section>('orders');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    isAdmin().then(setAllowed).catch(() => setAllowed(false));
  }, []);

  if (Platform.OS !== 'web') {
    return (
      <Screen>
        <ScreenHeader title={t('billing.admin.title')} />
        <EmptyState title={t('billing.admin.webOnly')} />
      </Screen>
    );
  }
  if (allowed === null) {
    return (
      <Screen>
        <ScreenHeader title={t('billing.admin.title')} />
        <Skeleton height={240} radius={radius.lg} />
      </Screen>
    );
  }
  if (!allowed) {
    return (
      <Screen>
        <ScreenHeader title={t('billing.admin.title')} />
        <EmptyState kind="error" title={t('billing.admin.forbidden')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('billing.admin.title')} />
      <Tabs
        accessibilityLabel={t('billing.admin.title')}
        value={section}
        onChange={setSection}
        items={[
          { key: 'orders', label: t('billing.admin.tabs.orders') },
          { key: 'grant', label: t('billing.admin.tabs.grant') },
          { key: 'ai', label: t('billing.admin.tabs.ai') },
        ]}
      />
      {section === 'orders' && <OrdersSection />}
      {section === 'grant' && <GrantSection />}
      {section === 'ai' && <AiSection />}
    </Screen>
  );
}

function OrdersSection() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [rows, setRows] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setRows(null);
    setError(false);
    adminOrders(status).then(setRows).catch(() => setError(true));
  }, [status]);
  useEffect(load, [load]);

  return (
    <View style={styles.section}>
      <View style={styles.chips}>
        <Chip label={t('billing.admin.allStatuses')} selected={status === null} onPress={() => setStatus(null)} />
        {STATUSES.map((s) => (
          <Chip key={s} label={t(`billing.order.status.${s}`)} selected={status === s} onPress={() => setStatus(s)} />
        ))}
        <Button label={t('billing.admin.refresh')} icon={RefreshCw} variant="ghost" size="sm" onPress={load} />
      </View>
      {error ? (
        <EmptyState kind="error" title={t('billing.admin.ordersError')} actionLabel={t('common.retry')} onAction={load} />
      ) : rows === null ? (
        <Skeleton height={200} radius={radius.lg} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('billing.admin.ordersEmpty')} />
      ) : (
        <Card padding="md">
          {rows.map((o, i) => (
            <View key={o.id} style={[styles.order, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <View style={styles.orderHead}>
                <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                  {o.email}
                </AppText>
                <Badge label={t(`billing.order.status.${o.status}`)} tone={TONE[o.status]} />
              </View>
              <AppText variant="caption" tone="secondary">
                {[isoDateTimeLabel(o.created_at, lang), o.provider, t(`billing.period.${o.period as 'monthly'}`), o.provider === 'manual' ? null : formatMoney(Number(o.amount), o.currency)]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
              {o.granted_until && (
                <AppText variant="caption" tone="secondary">
                  {`${t('billing.admin.col.until')}: ${isoDateLabel(o.granted_until, lang)}`}
                </AppText>
              )}
              {o.grant_error && o.grant_error !== 'pending' && (
                <AppText variant="caption" tone="negative">
                  {t('billing.admin.grantError', { error: o.grant_error })}
                </AppText>
              )}
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function GrantSection() {
  const { t, lang } = useI18n();
  const [email, setEmail] = useState('');
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'positive' | 'negative'; text: string } | null>(null);

  const submit = async () => {
    const input = AdminGrantRequest.safeParse({ email: email.trim(), days: Number(days) });
    if (!input.success) {
      setResult({ tone: 'negative', text: t('billing.admin.grant.invalid') });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const r = await invokeFn(FUNCTIONS.adminGrant, input.data, AdminGrantResponse);
      setResult({ tone: 'positive', text: t('billing.admin.grant.done', { email: input.data.email, date: isoDateLabel(r.premiumUntil, lang) }) });
    } catch (e) {
      const notFound = e instanceof FnError && e.code === 'not_found';
      setResult({ tone: 'negative', text: t(notFound ? 'billing.admin.grant.notFound' : 'billing.admin.grant.failed') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={styles.section}>
        <Input label={t('billing.admin.grant.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"/>
        <Input label={t('billing.admin.grant.days')} value={days} onChangeText={setDays} keyboardType="number-pad" />
        <AppText variant="caption" tone="muted">
          {t('billing.admin.grant.note')}
        </AppText>
        {result && (
          <AppText variant="body" tone={result.tone} accessibilityRole="alert">
            {result.text}
          </AppText>
        )}
        <Button label={t('billing.admin.grant.submit')} fullWidth loading={busy} disabled={busy} onPress={submit} />
      </View>
    </Card>
  );
}

function AiSection() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<AiUsageRow[] | null>(null);
  const [failures, setFailures] = useState<AiFailure[]>([]);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setRows(null);
    setError(false);
    Promise.all([adminAiUsage(days), adminAiFailures()])
      .then(([u, f]) => {
        setRows(u);
        setFailures(f);
      })
      .catch(() => setError(true));
  }, [days]);
  useEffect(load, [load]);

  const pct = (r: number | null) => (r === null ? '-' : `${(Number(r) * 100).toFixed(1)}%`);
  const ms = (v: number | null) => (v === null ? '-' : `${(v / 1000).toFixed(1)} s`);

  return (
    <View style={styles.section}>
      <View style={styles.chips}>
        {[7, 30, 90].map((d) => (
          <Chip key={d} label={t('billing.admin.ai.range', { days: d })} selected={days === d} onPress={() => setDays(d)} />
        ))}
      </View>
      {error ? (
        <EmptyState kind="error" title={t('billing.admin.ordersError')} actionLabel={t('common.retry')} onAction={load} />
      ) : rows === null ? (
        <Skeleton height={200} radius={radius.lg} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('billing.admin.ai.empty')} />
      ) : (
        rows.map((r) => (
          <Card key={r.kind} padding="md">
            <AppText variant="h3">{t(`billing.admin.ai.kind.${r.kind as 'scan'}`)}</AppText>
            <View style={styles.stats}>
              {[
                [t('billing.admin.ai.total'), String(r.total)],
                [t('billing.admin.ai.failed'), String(r.failed)],
                [t('billing.admin.ai.limited'), String(r.limited)],
                [t('billing.admin.ai.failRatio'), pct(r.fail_ratio)],
                [t('billing.admin.ai.avgLatency'), ms(r.avg_latency_ms)],
                [t('billing.admin.ai.p95'), ms(r.p95_latency_ms)],
              ].map(([label, value]) => (
                <View key={label} style={styles.stat}>
                  <AppText variant="caption" tone="secondary">
                    {label}
                  </AppText>
                  <AppText variant="bodyStrong" numeric>
                    {value}
                  </AppText>
                </View>
              ))}
            </View>
          </Card>
        ))
      )}
      <Card padding="md">
        <AppText variant="h3">{t('billing.admin.ai.failures')}</AppText>
        {failures.length === 0 ? (
          <AppText variant="body" tone="secondary" style={styles.order}>
            {t('billing.admin.ai.noFailures')}
          </AppText>
        ) : (
          failures.map((f, i) => (
            <View key={`${f.created_at}-${i}`} style={[styles.order, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <AppText variant="caption" tone="secondary">
                {`${isoDateTimeLabel(f.created_at, lang)} · ${t(`billing.admin.ai.kind.${f.kind as 'scan'}`)} · ${f.email}`}
              </AppText>
              <AppText variant="body">{f.error ?? '-'}</AppText>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  order: { gap: space.xxs, paddingVertical: space.md, paddingHorizontal: space.xs },
  orderHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm },
  stat: { width: '33.33%', paddingVertical: space.sm, gap: space.xxs },
});
