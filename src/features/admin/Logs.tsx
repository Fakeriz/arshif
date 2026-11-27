import { Search, User } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Badge, Chip, EmptyState, Icon, Input, PressableScale, Skeleton } from '@/components/ui';
import { adminAiUsage, type OrderStatus } from '@/data/remote/api';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { downloadCsv, fetchAdminAiFailures, fetchAdminOrders } from './adminApi';
import { copy } from './copy';
import { date, dateTime, msLabel, num, pct } from './format';
import {
  CopyChip,
  DataState,
  HeroInkPanel,
  Panel,
  ProportionBar,
  Rows,
  SectionToolbar,
  useLoad,
  type AdminNavigate,
} from './parts';

const KINDS = ['scan', 'voice', 'import', 'coach'] as const;

/** FR-ADM-3: pemakaian AI per jenis (OCR, Voice Log, Import PDF, Coach) + rasio gagal + latensi + triage kegagalan. */
export function AiSection({ onNavigate }: { onNavigate?: AdminNavigate }) {
  const a = copy.ai;
  const { colors } = useTheme();
  const [days, setDays] = useState(30);
  const [failKind, setFailKind] = useState<string>('all');
  const [failQuery, setFailQuery] = useState('');
  const [csvNotice, setCsvNotice] = useState<string | null>(null);
  const load = useLoad(() => Promise.all([adminAiUsage(days), fetchAdminAiFailures(100)]), [days]);
  const { width } = useWindowDimensions();
  const cols = width >= 860 ? 2 : 1;

  const exportCsv = () => {
    if (!load.data) return;
    const [, failures] = load.data;
    const headers = ['created_at', 'kind', 'email', 'error', 'latency_ms'];
    const rows = failures.map((f) => [f.created_at, f.kind, f.email, f.error, f.latency_ms]);
    downloadCsv(`arshif-ai-failures-${days}d.csv`, headers, rows);
    setCsvNotice(copy.exportedCsv(rows.length));
  };

  return (
    <View style={styles.gap}>
      <SectionToolbar
        left={
          <View style={styles.chips}>
            {[1, 7, 30, 90].map((d) => (
              <Chip key={d} label={a.range(d)} selected={days === d} onPress={() => setDays(d)} />
            ))}
          </View>
        }
        updatedAt={load.updatedAt}
        loading={load.loading && load.data !== null}
        onReload={load.reload}
        onExportCsv={exportCsv}
        exportDisabled={!load.data || load.data[1].length === 0}
      />

      {csvNotice && (
        <AppText variant="caption" tone="positive" accessibilityRole="alert">
          {csvNotice}
        </AppText>
      )}

      <DataState
        load={load}
        loadingLabel={a.loading}
        errorTitle={a.error}
        skeleton={
          <View style={styles.gap}>
            <Skeleton height={160} radius={radius.card} />
            <Skeleton height={220} radius={radius.lg} />
          </View>
        }
      >
        {([rows, failures]) => {
          const totalAll = rows.reduce((s, r) => s + r.total, 0);
          const okAll = rows.reduce((s, r) => s + r.ok, 0);
          const failedAll = rows.reduce((s, r) => s + r.failed, 0);
          const limitedAll = rows.reduce((s, r) => s + r.limited, 0);
          const nonLimited = okAll + failedAll;
          const successRate = nonLimited > 0 ? okAll / nonLimited : null;
          const p95Values = rows.map((r) => r.p95_latency_ms).filter((v): v is number => v !== null);
          const peakP95 = p95Values.length > 0 ? Math.max(...p95Values) : null;

          const kindFailures = failKind === 'all' ? failures : failures.filter((f) => f.kind === failKind);
          const errCounts = new Map<string, number>();
          for (const f of kindFailures) {
            const code = (f.error || 'unknown').trim();
            errCounts.set(code, (errCounts.get(code) ?? 0) + 1);
          }
          const topErrors = [...errCounts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5);

          const fq = failQuery.trim().toLowerCase();
          const filteredFailures = kindFailures.filter((f) => {
            if (!fq) return true;
            return f.email.toLowerCase().includes(fq) || (f.error ?? '').toLowerCase().includes(fq) || f.kind.toLowerCase().includes(fq);
          });

          const allKinds = [...KINDS, ...rows.map((r) => r.kind).filter((k) => !(KINDS as readonly string[]).includes(k))];

          return (
            <View style={styles.gap}>
              <HeroInkPanel>
                <AiHeroBody
                  days={days}
                  successRate={successRate}
                  totalAll={totalAll}
                  okAll={okAll}
                  failedAll={failedAll}
                  limitedAll={limitedAll}
                  peakP95={peakP95}
                  empty={rows.length === 0}
                />
              </HeroInkPanel>

              <View style={[styles.grid, cols === 2 && styles.gridWide]}>
                {allKinds.map((kind) => {
                  const r = rows.find((x) => x.kind === kind);
                  const failR = r?.fail_ratio !== null && r?.fail_ratio !== undefined ? Number(r.fail_ratio) : null;
                  const healthBadge = !r
                    ? { label: a.notUsed, tone: 'neutral' as const }
                    : failR !== null && failR >= 0.15
                      ? { label: a.degraded, tone: 'negative' as const }
                      : failR !== null && failR >= 0.05
                        ? { label: a.elevated, tone: 'warning' as const }
                        : { label: a.healthy, tone: 'positive' as const };

                  return (
                    <View key={kind} style={cols === 2 ? styles.cell : undefined}>
                      <Panel title={a.kind[kind] ?? kind} right={<Badge label={healthBadge.label} tone={healthBadge.tone} />} padding="md">
                        {r ? (
                          <ProportionBar
                            height={6}
                            segments={[
                              { key: 'ok', value: r.ok, color: colors.positive },
                              { key: 'failed', value: r.failed, color: colors.negative },
                              { key: 'limited', value: r.limited, color: colors.warning },
                            ]}
                          />
                        ) : null}
                        <View style={styles.stats}>
                          {[
                            [a.total, r ? num(r.total) : '0'],
                            [a.failed, r ? num(r.failed) : '0'],
                            [a.failRatio, r ? pct(r.fail_ratio) : '-'],
                            [a.avgLatency, r ? msLabel(r.avg_latency_ms) : '-'],
                            [a.p95, r ? msLabel(r.p95_latency_ms) : '-'],
                            [a.limited, r ? num(r.limited) : '0'],
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
                      </Panel>
                    </View>
                  );
                })}
              </View>

              <Panel title={a.failures} right={<Badge label={num(filteredFailures.length)} tone={filteredFailures.length > 0 ? 'negative' : 'neutral'} />}>
                {failures.length === 0 ? (
                  <AppText variant="body" tone="secondary">
                    {a.noFailures}
                  </AppText>
                ) : (
                  <View style={styles.gapSm}>
                    <View style={styles.chips}>
                      {(['all', ...KINDS] as const).map((k) => (
                        <Chip key={k} label={a.kindShort[k] ?? k} selected={failKind === k} onPress={() => setFailKind(k)} />
                      ))}
                    </View>
                    {topErrors.length > 0 && (
                      <View style={styles.chips}>
                        {topErrors.map(([err, cnt]) => (
                          <Chip
                            key={err}
                            label={err}
                            count={cnt}
                            selected={failQuery.trim().toLowerCase() === err.toLowerCase()}
                            onPress={() => setFailQuery((cur) => (cur.trim().toLowerCase() === err.toLowerCase() ? '' : err))}
                          />
                        ))}
                      </View>
                    )}
                    <Input label={a.filterFailures} value={failQuery} onChangeText={setFailQuery} icon={Search} autoCapitalize="none" autoCorrect={false} />
                    {filteredFailures.length === 0 ? (
                      <AppText variant="body" tone="secondary">
                        {a.noFilteredFailures}
                      </AppText>
                    ) : (
                      <Rows>
                        {filteredFailures.map((f, i) => (
                          <View key={`${f.created_at}-${i}`} style={styles.gapXs}>
                            <View style={styles.line}>
                              <Badge label={a.kind[f.kind] ?? f.kind} tone="neutral" />
                              <AppText variant="caption" tone="secondary" numeric style={styles.flex}>
                                {[dateTime(f.created_at), f.latency_ms !== null ? msLabel(f.latency_ms) : null].filter(Boolean).join(' · ')}
                              </AppText>
                              {onNavigate ? (
                                <PressableScale
                                  onPress={() => onNavigate({ bagian: 'pengguna', q: f.email })}
                                  hitSlop={8}
                                  accessibilityLabel={`${a.openUser}: ${f.email}`}
                                  focusRadius={radius.control}
                                  style={[styles.userPill, { backgroundColor: colors.fill, borderColor: colors.border }]}
                                >
                                  <Icon icon={User} color={colors.textSecondary} size={12} />
                                  <AppText variant="overline" tone="primary" numberOfLines={1}>
                                    {f.email}
                                  </AppText>
                                </PressableScale>
                              ) : (
                                <AppText variant="caption" tone="secondary">
                                  {f.email}
                                </AppText>
                              )}
                            </View>
                            <AppText variant="body">{f.error ?? '-'}</AppText>
                          </View>
                        ))}
                      </Rows>
                    )}
                  </View>
                )}
              </Panel>
            </View>
          );
        }}
      </DataState>
    </View>
  );
}

const STATUSES: OrderStatus[] = ['pending', 'paid', 'expired', 'failed', 'refunded'];

function AiHeroBody({
  days,
  successRate,
  totalAll,
  okAll,
  failedAll,
  limitedAll,
  peakP95,
  empty,
}: {
  days: number;
  successRate: number | null;
  totalAll: number;
  okAll: number;
  failedAll: number;
  limitedAll: number;
  peakP95: number | null;
  empty: boolean;
}) {
  const { colors } = useTheme();
  const a = copy.ai;
  return (
    <>
      <View style={styles.heroHead}>
        <View style={styles.flex}>
          <AppText variant="caption" tone="secondary">
            {a.summaryLabel(days)}
          </AppText>
          <AppText variant="balanceHero" numeric>
            {successRate !== null ? pct(successRate) : '-'}
          </AppText>
        </View>
        <View style={styles.chips}>
          <Badge label={a.summaryRequests(num(totalAll))} tone="neutral" />
          <Badge label={a.summaryFailed(num(failedAll))} tone={failedAll > 0 ? 'negative' : 'positive'} />
          {limitedAll > 0 && <Badge label={a.summaryLimited(num(limitedAll))} tone="warning" />}
          {peakP95 !== null && <Badge label={a.summaryPeakP95(msLabel(peakP95))} tone="neutral" />}
        </View>
      </View>
      <ProportionBar
        height={8}
        segments={[
          { key: 'ok', value: okAll, color: colors.positive },
          { key: 'failed', value: failedAll, color: colors.negative },
          { key: 'limited', value: limitedAll, color: colors.warning },
        ]}
      />
      {empty && (
        <AppText variant="caption" tone="secondary">
          {a.empty(days)}
        </AppText>
      )}
    </>
  );
}
const PROVIDERS = ['all', 'xendit', 'paddle', 'manual'] as const;
type ProviderFilter = (typeof PROVIDERS)[number];

const TONE: Record<OrderStatus, 'warning' | 'positive' | 'neutral' | 'negative' | 'info'> = {
  pending: 'warning',
  paid: 'positive',
  expired: 'neutral',
  failed: 'negative',
  refunded: 'info',
};

const isStuckGrant = (status: OrderStatus, grantError: string | null) =>
  status === 'paid' && Boolean(grantError) && !['pending', 'refund_applied', 'partial_refund'].includes(grantError!);

/** FR-ADM-3: pesanan web (Xendit + Paddle) dan grant manual, dengan ringkasan, filter multi-sumbu, dan ekspor CSV. */
export function OrdersSection({ onNavigate }: { onNavigate?: AdminNavigate }) {
  const o = copy.orders;
  const { colors } = useTheme();
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [provider, setProvider] = useState<ProviderFilter>('all');
  const [search, setSearch] = useState('');
  const [csvNotice, setCsvNotice] = useState<string | null>(null);
  const load = useLoad(() => fetchAdminOrders(status, 300), [status]);

  const filtered = useMemo(() => {
    const rows = load.data ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (provider !== 'all' && r.provider !== provider) return false;
      if (!q) return true;
      return (
        r.email.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.method ?? '').toLowerCase().includes(q) ||
        r.provider.toLowerCase().includes(q)
      );
    });
  }, [load.data, provider, search]);

  const summary = useMemo(() => {
    let paid = 0;
    let pending = 0;
    let manual = 0;
    let stuck = 0;
    const rev = new Map<string, number>();
    for (const r of filtered) {
      if (r.status === 'paid') paid += 1;
      if (r.status === 'pending') pending += 1;
      if (r.provider === 'manual') manual += 1;
      if (isStuckGrant(r.status, r.grant_error)) stuck += 1;
      if (r.status === 'paid' && r.provider !== 'manual') {
        rev.set(r.currency, (rev.get(r.currency) ?? 0) + Number(r.amount));
      }
    }
    return { paid, pending, manual, stuck, rev: [...rev.entries()] };
  }, [filtered]);

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const headers = ['id', 'email', 'provider', 'period', 'status', 'currency', 'amount', 'method', 'created_at', 'paid_at', 'granted_until', 'grant_error'];
    const rows = filtered.map((r) => [
      r.id,
      r.email,
      r.provider,
      r.period,
      r.status,
      r.currency,
      r.amount,
      r.method,
      r.created_at,
      r.paid_at,
      r.granted_until,
      r.grant_error,
    ]);
    downloadCsv('arshif-pesanan.csv', headers, rows);
    setCsvNotice(copy.exportedCsv(rows.length));
  };

  return (
    <View style={styles.gap}>
      <AppText variant="caption" tone="secondary">
        {o.notConfigured}
      </AppText>

      <HeroInkPanel>
        <View style={styles.heroHead}>
          <View style={styles.flex}>
            <AppText variant="caption" tone="secondary">
              {o.summaryLabel}
            </AppText>
            {summary.rev.length > 0 ? (
              <View style={styles.revRow}>
                {summary.rev.map(([cur, amt]) => (
                  <AppText key={cur} variant="amountHero" numeric>
                    {formatMoney(amt, cur)}
                  </AppText>
                ))}
              </View>
            ) : (
              <AppText variant="h2">{num(filtered.length)}</AppText>
            )}
          </View>
          <View style={styles.chips}>
            <Badge label={o.paidCount(num(summary.paid))} tone="positive" />
            <Badge label={o.pendingCount(num(summary.pending))} tone={summary.pending > 0 ? 'warning' : 'neutral'} />
            <Badge label={o.manualCount(num(summary.manual))} tone="neutral" />
            {summary.stuck > 0 && <Badge label={o.stuckCount(num(summary.stuck))} tone="negative" />}
          </View>
        </View>
        {summary.rev.length === 0 && (
          <AppText variant="caption" tone="secondary">
            {o.noRevenueInFilter}
          </AppText>
        )}
      </HeroInkPanel>

      <SectionToolbar
        left={
          <View style={styles.chips}>
            <Chip label={o.all} selected={status === null} onPress={() => setStatus(null)} />
            {STATUSES.map((s) => (
              <Chip key={s} label={o.status[s]} selected={status === s} onPress={() => setStatus(s)} />
            ))}
          </View>
        }
        updatedAt={load.updatedAt}
        loading={load.loading && load.data !== null}
        onReload={load.reload}
        onExportCsv={exportCsv}
        exportDisabled={filtered.length === 0}
      />

      <View style={styles.chips}>
        {PROVIDERS.map((p) => (
          <Chip
            key={p}
            label={p === 'all' ? o.allProviders : (o.provider[p] ?? p)}
            selected={provider === p}
            onPress={() => setProvider(p)}
          />
        ))}
      </View>

      <Input label={o.searchPlaceholder} value={search} onChangeText={setSearch} icon={Search} autoCapitalize="none" autoCorrect={false} />

      {csvNotice && (
        <AppText variant="caption" tone="positive" accessibilityRole="alert">
          {csvNotice}
        </AppText>
      )}

      <DataState
        load={load}
        loadingLabel={o.loading}
        errorTitle={o.error}
        skeleton={<Skeleton height={200} radius={radius.lg} />}
        isEmpty={() => filtered.length === 0}
        empty={<EmptyState compact title={o.empty} />}
      >
        {() => (
          <Panel padding="md">
            <Rows>
              {filtered.map((r) => {
                const stuck = isStuckGrant(r.status, r.grant_error);
                return (
                  <View key={r.id} style={styles.gapXs}>
                    <View style={styles.line}>
                      {onNavigate ? (
                        <PressableScale
                          onPress={() => onNavigate({ bagian: 'pengguna', q: r.email })}
                          hitSlop={8}
                          accessibilityLabel={r.email}
                          focusRadius={radius.xs}
                          containerStyle={styles.flex}
                          style={styles.emailLink}
                        >
                          <AppText variant="bodyStrong" numberOfLines={1}>
                            {r.email}
                          </AppText>
                        </PressableScale>
                      ) : (
                        <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                          {r.email}
                        </AppText>
                      )}
                      <Badge label={o.provider[r.provider] ?? r.provider} tone="neutral" />
                      <Badge label={o.status[r.status]} tone={TONE[r.status]} />
                    </View>
                    <AppText variant="caption" tone="secondary" numeric>
                      {[
                        dateTime(r.created_at),
                        o.period[r.period] ?? r.period,
                        r.provider === 'manual' ? null : formatMoney(Number(r.amount), r.currency),
                        r.method,
                        r.paid_at ? o.paidAt(dateTime(r.paid_at)) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </AppText>
                    <View style={styles.line}>
                      {r.granted_until && (
                        <AppText variant="caption" tone="secondary" style={styles.flex}>
                          {o.until(date(r.granted_until))}
                        </AppText>
                      )}
                      <CopyChip value={r.id} label={r.id.slice(0, 8)} accessibilityLabel={`Salin ID pesanan ${r.id}`} />
                    </View>
                    {stuck && r.grant_error && (
                      <View style={[styles.alertStrip, { backgroundColor: colors.negativeSoft }]}>
                        <AppText variant="caption" tone="negative">
                          {o.grantError(r.grant_error)}
                        </AppText>
                      </View>
                    )}
                  </View>
                );
              })}
            </Rows>
          </Panel>
        )}
      </DataState>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.lg },
  gapSm: { gap: space.sm },
  gapXs: { gap: space.xs },
  heroHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  revRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    alignItems: 'baseline',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  grid: { gap: space.lg },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '48.5%', flexGrow: 1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm },
  stat: { width: '33.33%', minWidth: 96, gap: space.xxs, paddingRight: space.sm },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  emailLink: { alignSelf: 'flex-start', paddingVertical: 2 },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 28,
    paddingHorizontal: space.sm,
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 220,
  },
  alertStrip: {
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  flex: { flex: 1, minWidth: 0 },
});
