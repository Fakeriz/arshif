import { ArrowRight } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Badge, Button, Chip, PressableScale, RollingNumber, Skeleton } from '@/components/ui';
import { adminDashboard, adminFxStatus, type AdminDashboard, type AdminFxStatus } from '@/data/remote/api';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { chartRamp, radius, space } from '@/theme/tokens';

import { fetchAdminOpsOverview, type AdminOpsOverview, type SystemHealthProbe } from './adminApi';
import { copy } from './copy';
import { ago, date, msLabel, num, pct } from './format';
import {
  DataState,
  HeroInkPanel,
  InsetBox,
  MetricCard,
  Panel,
  ProportionBar,
  Rows,
  SectionToolbar,
  useLoad,
  type AdminNavigate,
} from './parts';

const c = copy.dashboard;
const AI_ORDER = ['scan', 'voice', 'import', 'coach'];

type DashboardBundle = {
  dash: AdminDashboard;
  ops: AdminOpsOverview | null;
  fx: AdminFxStatus | null;
};

/** FR-ADM-1. Angka utama = pengguna aktif hari ini di HeroInkPanel; sisanya mendukung. Semua dari server. */
export function DashboardSection({
  onNavigate,
  health,
  onRecheckHealth,
}: {
  onNavigate?: AdminNavigate;
  health?: SystemHealthProbe | null;
  onRecheckHealth?: () => void;
}) {
  const load = useLoad<DashboardBundle>(async () => {
    const [dash, ops, fx] = await Promise.all([
      adminDashboard(),
      fetchAdminOpsOverview(),
      adminFxStatus().catch(() => null),
    ]);
    return { dash, ops, fx };
  }, []);
  const { width } = useWindowDimensions();
  const wide = width >= 760;

  return (
    <DataState
      load={load}
      loadingLabel={c.loading}
      errorTitle={c.error}
      skeleton={
        <View style={styles.gap}>
          <Skeleton height={220} radius={radius.card} />
          <Skeleton height={140} radius={radius.lg} />
          <Skeleton height={160} radius={radius.lg} />
        </View>
      }
    >
      {({ dash: d, ops, fx }) => (
        <View style={styles.gap}>
          <SectionToolbar
            left={
              <AppText variant="caption" tone="secondary">
                {c.today(date(`${d.today}T12:00:00`))}
              </AppText>
            }
            updatedAt={load.updatedAt}
            loading={load.loading && load.data !== null}
            onReload={() => {
              load.reload();
              onRecheckHealth?.();
            }}
          />

          <DauHero d={d} ops={ops} />

          <View style={[styles.grid, wide && styles.gridWide]}>
            <View style={wide ? styles.colHalf : undefined}>
              <TotalUsersCard d={d} ops={ops} onNavigate={onNavigate} />
            </View>
            <View style={wide ? styles.colHalf : undefined}>
              <PremiumCard d={d} ops={ops} onNavigate={onNavigate} />
            </View>
          </View>

          <View style={[styles.grid, wide && styles.gridWide]}>
            <View style={wide ? styles.colHalf : undefined}>
              <AiToday d={d} onNavigate={onNavigate} />
            </View>
            <View style={wide ? styles.colHalf : undefined}>
              <Revenue d={d} ops={ops} onNavigate={onNavigate} />
            </View>
          </View>

          <SystemHealthPanel health={health ?? null} fx={fx} ops={ops} onNavigate={onNavigate} onRecheckHealth={onRecheckHealth} wide={wide} />
        </View>
      )}
    </DataState>
  );
}

function DauHero({ d, ops }: { d: AdminDashboard; ops: AdminOpsOverview | null }) {
  const [range, setRange] = useState<'7' | '30'>('7');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const has30 = Boolean(ops?.dau_30 && ops.dau_30.length > 0);
  const series = range === '30' && has30 ? ops!.dau_30 : d.dau_7;

  const yesterday = d.dau_7.length >= 2 ? d.dau_7[d.dau_7.length - 2].users : null;
  const delta = yesterday !== null ? d.dau - yesterday : null;
  const avg7 = d.dau_7.length > 0 ? d.dau_7.reduce((s, r) => s + r.users, 0) / d.dau_7.length : 0;
  const share = d.total_users > 0 ? d.dau / d.total_users : 0;

  return (
    <HeroInkPanel>
      <View style={styles.heroTop}>
        <View style={styles.flex}>
          <AppText variant="caption" tone="secondary">
            {c.dau}
          </AppText>
          <RollingNumber value={num(d.dau)} variant="balanceHero" accessibilityLabel={`${c.dau}: ${num(d.dau)}`} />
        </View>
        <View style={styles.heroBadges}>
          {delta !== null && (
            <Badge
              label={delta > 0 ? c.dauDeltaUp(delta) : delta < 0 ? c.dauDeltaDown(delta) : c.dauDeltaFlat}
              tone={delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral'}
            />
          )}
          <Badge label={c.dauShare(pct(share))} tone="neutral" />
        </View>
      </View>

      <View style={styles.heroMetaRow}>
        <AppText variant="caption" tone="secondary" style={styles.flex}>
          {c.dauHint}
        </AppText>
        <AppText variant="caption" tone="secondary" numeric>
          {c.dauAvg7(avg7.toFixed(1).replace('.', ','))}
        </AppText>
      </View>

      <ActivityBars
        rows={series}
        range={range}
        has30={has30}
        onRange={setRange}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
      />
    </HeroInkPanel>
  );
}

function ActivityBars({
  rows,
  range,
  has30,
  onRange,
  selectedDay,
  onSelectDay,
}: {
  rows: { day: string; users: number }[];
  range: '7' | '30';
  has30: boolean;
  onRange: (r: '7' | '30') => void;
  selectedDay: string | null;
  onSelectDay: (d: string | null) => void;
}) {
  const { scheme, colors } = useTheme();
  const ramp = chartRamp[scheme];
  const max = Math.max(1, ...rows.map((r) => r.users));
  const picked = rows.find((r) => r.day === selectedDay) ?? rows[rows.length - 1] ?? null;

  return (
    <View style={styles.chartWrap} accessibilityLabel={c.dau7}>
      <View style={styles.chartHead}>
        <AppText variant="caption" tone="secondary" style={styles.flex}>
          {range === '30' && has30 ? `${c.dau7} · ${c.dau30}` : c.dau7}
        </AppText>
        {has30 && (
          <View style={styles.rangeRow}>
            <Chip label={c.range7} selected={range === '7'} onPress={() => onRange('7')} />
            <Chip label={c.range30} selected={range === '30'} onPress={() => onRange('30')} />
          </View>
        )}
      </View>

      <View style={styles.barsRow}>
        {rows.map((r, i) => {
          const isLast = i === rows.length - 1;
          const isPicked = picked?.day === r.day;
          const ratio = r.users / max;
          const heightPx = r.users > 0 ? Math.max(8, Math.round(ratio * 72)) : 3;
          const barColor = isPicked || isLast ? ramp[4] : r.users > 0 ? ramp[2] : colors.track;
          const shortDate = date(`${r.day}T12:00:00`).replace(/ \d{4}$/, '');
          return (
            <PressableScale
              key={r.day}
              onPress={() => onSelectDay(r.day === selectedDay ? null : r.day)}
              accessibilityLabel={`${date(`${r.day}T12:00:00`)}: ${r.users}`}
              focusRadius={radius.xs}
              scaleTo={0.96}
              containerStyle={styles.barSlot}
              style={styles.barCol}
            >
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: heightPx, backgroundColor: barColor }]} />
              </View>
              {range === '7' && (
                <AppText variant="overline" tone={isPicked ? 'primary' : 'secondary'} numeric numberOfLines={1}>
                  {shortDate.split(' ')[0]}
                </AppText>
              )}
            </PressableScale>
          );
        })}
      </View>

      {picked && (
        <AppText variant="caption" tone="secondary" numeric>
          {c.selectedDay(date(`${picked.day}T12:00:00`), num(picked.users))}
        </AppText>
      )}
    </View>
  );
}

function TotalUsersCard({ d, ops, onNavigate }: { d: AdminDashboard; ops: AdminOpsOverview | null; onNavigate?: AdminNavigate }) {
  const onboardedNote =
    ops && d.total_users > 0
      ? c.onboardedRate(num(ops.onboarded_users), pct(ops.onboarded_users / d.total_users))
      : undefined;
  return (
    <MetricCard
      label={c.totalUsers}
      value={num(d.total_users)}
      badge={{ label: c.newToday(d.new_today), tone: d.new_today > 0 ? 'positive' : 'neutral' }}
      note={onboardedNote}
      onPress={onNavigate ? () => onNavigate({ bagian: 'pengguna' }) : undefined}
    />
  );
}

function PremiumCard({ d, ops, onNavigate }: { d: AdminDashboard; ops: AdminOpsOverview | null; onNavigate?: AdminNavigate }) {
  const { scheme } = useTheme();
  const ramp = chartRamp[scheme];
  const conv = d.total_users > 0 ? d.premium_users / d.total_users : 0;
  const sourceEntries = Object.entries(d.premium_by_source).filter(([, n]) => n > 0);
  const segments = sourceEntries.map(([k, n], idx) => ({
    key: k,
    value: n,
    color: ramp[Math.min(ramp.length - 1, ramp.length - 1 - (idx % ramp.length))],
  }));
  const noteParts = sourceEntries.map(([k, n]) => `${num(n)} ${c.premiumSources[k] ?? k}`);
  if (d.suspended_users > 0) noteParts.push(c.suspended(d.suspended_users));

  return (
    <MetricCard
      label={c.premium}
      value={num(d.premium_users)}
      badge={{ label: c.conversionRate(pct(conv)), tone: d.premium_users > 0 ? 'accent' : 'neutral' }}
      note={noteParts.join(' · ') || undefined}
      onPress={onNavigate ? () => onNavigate({ bagian: 'pengguna' }) : undefined}
      footer={
        <View style={styles.cardFooter}>
          {segments.length > 0 && <ProportionBar segments={segments} accessibilityLabel={c.premium} />}
          {(d.suspended_users > 0 || (ops?.stuck_orders ?? 0) > 0) && (
            <View style={styles.badgeRow}>
              {d.suspended_users > 0 && <Badge label={c.suspended(d.suspended_users)} tone="warning" />}
              {ops && ops.stuck_orders > 0 && (
                <PressableScale
                  onPress={() => onNavigate?.({ bagian: 'pesanan' })}
                  hitSlop={8}
                  accessibilityLabel={c.stuckOrders(ops.stuck_orders)}
                  focusRadius={radius.badge}
                >
                  <Badge label={c.stuckOrders(ops.stuck_orders)} tone="negative" />
                </PressableScale>
              )}
            </View>
          )}
        </View>
      }
    />
  );
}

function AiToday({ d, onNavigate }: { d: AdminDashboard; onNavigate?: AdminNavigate }) {
  const { colors } = useTheme();
  const kinds = AI_ORDER.filter((k) => d.ai_today[k]).concat(Object.keys(d.ai_today).filter((k) => !AI_ORDER.includes(k)));
  const totalCalls = kinds.reduce((sum, k) => sum + (d.ai_today[k]?.total ?? 0), 0);
  const totalFailed = kinds.reduce((sum, k) => sum + (d.ai_today[k]?.failed ?? 0), 0);

  return (
    <Panel
      title={c.aiToday}
      right={
        onNavigate ? (
          <Button label={c.openAi} icon={ArrowRight} variant="ghost" size="sm" onPress={() => onNavigate({ bagian: 'ai' })} />
        ) : undefined
      }
    >
      {kinds.length === 0 ? (
        <AppText variant="body" tone="secondary">
          {c.aiNone}
        </AppText>
      ) : (
        <View style={styles.gapSm}>
          <View style={styles.badgeRow}>
            <Badge label={c.aiTotalToday(num(totalCalls))} tone="neutral" />
            {totalFailed > 0 && <Badge label={c.aiFailed(totalFailed)} tone="negative" />}
          </View>
          <Rows>
            {kinds.map((k) => {
              const row = d.ai_today[k];
              return (
                <View key={k} style={styles.gapXs}>
                  <View style={styles.line}>
                    <AppText variant="body" style={styles.flex}>
                      {copy.ai.kind[k] ?? k}
                    </AppText>
                    {row.failed > 0 && <Badge label={c.aiFailed(row.failed)} tone="negative" />}
                    <AppText variant="bodyStrong" numeric>
                      {num(row.total)}
                    </AppText>
                  </View>
                  <ProportionBar
                    height={6}
                    segments={[
                      { key: 'ok', value: Math.max(0, row.total - row.failed), color: colors.accent },
                      { key: 'failed', value: row.failed, color: colors.negative },
                    ]}
                  />
                </View>
              );
            })}
          </Rows>
        </View>
      )}
    </Panel>
  );
}

function Revenue({ d, ops, onNavigate }: { d: AdminDashboard; ops: AdminOpsOverview | null; onNavigate?: AdminNavigate }) {
  const entries = Object.entries(d.revenue_month);
  const webhookEntries = ops ? Object.entries(ops.webhooks_7d).filter(([, n]) => n > 0) : [];

  return (
    <Panel
      title={c.revenue}
      right={
        onNavigate ? (
          <Button label={c.openOrders} icon={ArrowRight} variant="ghost" size="sm" onPress={() => onNavigate({ bagian: 'pesanan' })} />
        ) : undefined
      }
    >
      {entries.length === 0 ? (
        <AppText variant="body" tone="secondary">
          {c.revenueEmpty}
        </AppText>
      ) : (
        <View style={styles.gapSm}>
          {entries.map(([cur, amount]) => (
            <AppText key={cur} variant="h2" numeric>
              {formatMoney(Number(amount), cur)}
            </AppText>
          ))}
          <AppText variant="caption" tone="secondary">
            {c.revenueWeb(d.paid_orders_month)}
          </AppText>
        </View>
      )}
      {webhookEntries.length > 0 && (
        <AppText variant="caption" tone="secondary" numeric>
          {c.webhooks7d(webhookEntries.map(([p, n]) => `${p} ${num(n)}`).join(' · '))}
        </AppText>
      )}
      <AppText variant="caption" tone="muted">
        {c.revenueStore}
      </AppText>
    </Panel>
  );
}

function SystemHealthPanel({
  health,
  fx,
  ops,
  onNavigate,
  onRecheckHealth,
  wide,
}: {
  health: SystemHealthProbe | null;
  fx: AdminFxStatus | null;
  ops: AdminOpsOverview | null;
  onNavigate?: AdminNavigate;
  onRecheckHealth?: () => void;
  wide: boolean;
}) {
  const latestFxRun = fx?.runs[0] ?? null;
  const latestAssetRun = ops?.asset_runs[0] ?? null;
  const curEntries = ops ? Object.entries(ops.currencies).sort((a, b) => b[1] - a[1]).slice(0, 5) : [];
  const langEntries = ops ? Object.entries(ops.langs).sort((a, b) => b[1] - a[1]) : [];

  const healthBadge = !health
    ? { label: copy.health.checking, tone: 'neutral' as const }
    : health.status === 'ready'
      ? { label: copy.health.ready(health.rttMs), tone: 'positive' as const }
      : health.status === 'live'
        ? { label: copy.health.live(health.rttMs), tone: 'positive' as const }
        : health.status === 'degraded'
          ? { label: copy.health.degraded, tone: 'warning' as const }
          : { label: copy.health.unreachable, tone: 'negative' as const };

  return (
    <Panel
      title={copy.health.title}
      right={
        onNavigate ? (
          <Button label={copy.health.openKurs} icon={ArrowRight} variant="ghost" size="sm" onPress={() => onNavigate({ bagian: 'kurs' })} />
        ) : undefined
      }
    >
      <View style={[styles.healthGrid, wide && styles.gridWide]}>
        <InsetBox style={wide ? styles.colThird : undefined}>
          <AppText variant="overline" tone="secondary">
            {copy.health.edgeDb}
          </AppText>
          <Badge label={healthBadge.label} tone={healthBadge.tone} />
          <AppText variant="caption" tone="secondary" numeric>
            {[
              health?.db === 'ok' ? copy.health.dbOk : health?.db ? copy.health.dbIssue(health.db) : null,
              health?.minClientVersion ? copy.health.minClient(health.minClientVersion) : null,
            ]
              .filter(Boolean)
              .join(' · ') || copy.health.checking}
          </AppText>
          {onRecheckHealth && (
            <PressableScale onPress={onRecheckHealth} hitSlop={8} accessibilityLabel={copy.health.recheck} focusRadius={radius.xs}>
              <AppText variant="overline" tone="primary">
                {copy.health.recheck}
              </AppText>
            </PressableScale>
          )}
        </InsetBox>

        <InsetBox style={wide ? styles.colThird : undefined}>
          <AppText variant="overline" tone="secondary">
            {copy.health.fxStatus}
          </AppText>
          {latestFxRun ? (
            <Badge label={latestFxRun.ok ? copy.fx.ok : copy.fx.failed} tone={latestFxRun.ok ? 'positive' : 'negative'} />
          ) : (
            <Badge label={copy.fx.none} tone="neutral" />
          )}
          <AppText variant="caption" tone="secondary" numeric>
            {fx?.latest_rate_date ? copy.fx.latestValue(date(`${fx.latest_rate_date}T12:00:00`), fx.codes) : copy.fx.none}
          </AppText>
        </InsetBox>

        <InsetBox style={wide ? styles.colThird : undefined}>
          <AppText variant="overline" tone="secondary">
            {copy.health.assetStatus}
          </AppText>
          {latestAssetRun ? (
            <>
              <Badge label={latestAssetRun.ok ? copy.fx.ok : copy.fx.failed} tone={latestAssetRun.ok ? 'positive' : 'negative'} />
              <AppText variant="caption" tone="secondary" numeric>
                {[
                  latestAssetRun.source,
                  `${num(latestAssetRun.updated)}/${num(latestAssetRun.symbols)}`,
                  latestAssetRun.duration_ms !== null ? msLabel(latestAssetRun.duration_ms) : null,
                  ago(latestAssetRun.ran_at),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
            </>
          ) : (
            <AppText variant="caption" tone="secondary">
              {copy.health.noAssetRun}
            </AppText>
          )}
        </InsetBox>
      </View>

      {(curEntries.length > 0 || langEntries.length > 0) && (
        <View style={styles.distRow}>
          <AppText variant="caption" tone="secondary">
            {c.distribution}
          </AppText>
          <View style={styles.badgeRow}>
            {curEntries.map(([code, n]) => (
              <Badge key={`cur-${code}`} label={`${code} · ${num(n)}`} tone="neutral" />
            ))}
            {langEntries.map(([lg, n]) => (
              <Badge key={`lg-${lg}`} label={`${lg.toUpperCase()} · ${num(n)}`} tone="info" />
            ))}
          </View>
        </View>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.lg },
  gapSm: { gap: space.sm },
  gapXs: { gap: space.xs },
  flex: { flex: 1, minWidth: 0 },
  grid: { gap: space.lg },
  gridWide: { flexDirection: 'row', alignItems: 'stretch' },
  colHalf: { flex: 1, minWidth: 0 },
  colThird: { flex: 1, minWidth: 0 },
  heroTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    alignItems: 'center',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  chartWrap: {
    gap: space.sm,
    paddingTop: space.xs,
  },
  chartHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: space.xs,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.xs,
    height: 98,
    paddingTop: space.xs,
  },
  barSlot: {
    flex: 1,
    minWidth: 0,
  },
  barCol: {
    alignItems: 'center',
    gap: space.xs,
  },
  barTrack: {
    height: 76,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '100%',
    maxWidth: 36,
    borderRadius: radius.bar,
  },
  cardFooter: {
    gap: space.sm,
    marginTop: space.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    alignItems: 'center',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  healthGrid: {
    gap: space.md,
  },
  distRow: {
    gap: space.xs,
    paddingTop: space.xs,
  },
});
