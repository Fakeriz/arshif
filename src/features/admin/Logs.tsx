import { RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Badge, Button, Chip, EmptyState, Skeleton } from '@/components/ui';
import { adminAiFailures, adminAiUsage, adminOrders, type OrderStatus } from '@/data/remote/api';
import { formatMoney } from '@/lib/money';
import { radius, space } from '@/theme/tokens';

import { copy } from './copy';
import { date, dateTime, num } from './format';
import { DataState, Panel, Refreshing, Rows, useLoad } from './parts';

const KINDS = ['scan', 'voice', 'import', 'coach'];

/** FR-ADM-3: pemakaian AI per jenis (OCR, Voice Log, Import PDF, Coach) + rasio gagal + latensi. */
export function AiSection() {
  const a = copy.ai;
  const [days, setDays] = useState(30);
  const load = useLoad(() => Promise.all([adminAiUsage(days), adminAiFailures()]), [days]);
  const { width } = useWindowDimensions();
  const cols = width >= 860 ? 2 : 1;
  const pct = (r: number | null) => (r === null ? '-' : `${(Number(r) * 100).toFixed(1).replace('.', ',')}%`);
  const sec = (v: number | null) => (v === null ? '-' : `${(v / 1000).toFixed(1).replace('.', ',')} dtk`);

  return (
    <View style={styles.gap}>
      <View style={styles.chips}>
        {[1, 7, 30, 90].map((d) => (
          <Chip key={d} label={a.range(d)} selected={days === d} onPress={() => setDays(d)} />
        ))}
        <Refreshing on={load.loading && load.data !== null} />
      </View>
      <DataState
        load={load}
        loadingLabel={a.loading}
        errorTitle={a.error}
        skeleton={<Skeleton height={220} radius={radius.lg} />}
        isEmpty={([rows]) => rows.length === 0}
        empty={<EmptyState compact title={a.empty(days)} />}
      >
        {([rows, failures]) => (
          <View style={styles.gap}>
            <View style={[styles.grid, cols === 2 && styles.gridWide]}>
              {KINDS.concat(rows.map((r) => r.kind).filter((k) => !KINDS.includes(k))).map((kind) => {
                const r = rows.find((x) => x.kind === kind);
                return (
                  <View key={kind} style={cols === 2 ? styles.cell : undefined}>
                    <Panel title={a.kind[kind] ?? kind} padding="md">
                      {r ? (
                        <View style={styles.stats}>
                          {[
                            [a.total, num(r.total)],
                            [a.failed, num(r.failed)],
                            [a.failRatio, pct(r.fail_ratio)],
                            [a.avgLatency, sec(r.avg_latency_ms)],
                            [a.p95, sec(r.p95_latency_ms)],
                            [a.limited, num(r.limited)],
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
                      ) : (
                        <AppText variant="body" tone="secondary">
                          {a.notUsed}
                        </AppText>
                      )}
                    </Panel>
                  </View>
                );
              })}
            </View>
            <Panel title={a.failures}>
              {failures.length === 0 ? (
                <AppText variant="body" tone="secondary">
                  {a.noFailures}
                </AppText>
              ) : (
                <Rows>
                  {failures.map((f, i) => (
                    <View key={`${f.created_at}-${i}`} style={styles.gapXs}>
                      <AppText variant="caption" tone="secondary">
                        {`${dateTime(f.created_at)} · ${a.kind[f.kind] ?? f.kind} · ${f.email}`}
                      </AppText>
                      <AppText variant="body">{f.error ?? '-'}</AppText>
                    </View>
                  ))}
                </Rows>
              )}
            </Panel>
          </View>
        )}
      </DataState>
    </View>
  );
}

const STATUSES: OrderStatus[] = ['pending', 'paid', 'expired', 'failed', 'refunded'];
const TONE: Record<OrderStatus, 'warning' | 'positive' | 'neutral' | 'negative' | 'info'> = {
  pending: 'warning', paid: 'positive', expired: 'neutral', failed: 'negative', refunded: 'info',
};

/** FR-ADM-3: pesanan web (Xendit + Paddle) dan grant manual, dengan status. */
export function OrdersSection() {
  const o = copy.orders;
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const load = useLoad(() => adminOrders(status), [status]);
  return (
    <View style={styles.gap}>
      <AppText variant="caption" tone="secondary">
        {o.notConfigured}
      </AppText>
      <View style={styles.chips}>
        <Chip label={o.all} selected={status === null} onPress={() => setStatus(null)} />
        {STATUSES.map((s) => (
          <Chip key={s} label={o.status[s]} selected={status === s} onPress={() => setStatus(s)} />
        ))}
        <Button label={copy.refresh} icon={RefreshCw} variant="ghost" size="sm" onPress={load.reload} loading={load.loading && load.data !== null} />
      </View>
      <DataState
        load={load}
        loadingLabel={o.loading}
        errorTitle={o.error}
        skeleton={<Skeleton height={200} radius={radius.lg} />}
        isEmpty={(rows) => rows.length === 0}
        empty={<EmptyState compact title={o.empty} />}
      >
        {(rows) => (
          <Panel padding="md">
            <Rows>
              {rows.map((r) => (
                <View key={r.id} style={styles.gapXs}>
                  <View style={styles.line}>
                    <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                      {r.email}
                    </AppText>
                    <Badge label={o.status[r.status]} tone={TONE[r.status]} />
                  </View>
                  <AppText variant="caption" tone="secondary">
                    {[dateTime(r.created_at), o.provider[r.provider] ?? r.provider, o.period[r.period] ?? r.period, r.provider === 'manual' ? null : formatMoney(Number(r.amount), r.currency), r.method]
                      .filter(Boolean)
                      .join(' · ')}
                  </AppText>
                  {r.granted_until && (
                    <AppText variant="caption" tone="secondary">
                      {o.until(date(r.granted_until))}
                    </AppText>
                  )}
                  {r.grant_error && r.grant_error !== 'pending' && r.grant_error !== 'refund_applied' && (
                    <AppText variant="caption" tone="negative">
                      {o.grantError(r.grant_error)}
                    </AppText>
                  )}
                </View>
              ))}
            </Rows>
          </Panel>
        )}
      </DataState>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.lg },
  gapXs: { gap: space.xxs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  grid: { gap: space.lg },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '48.5%', flexGrow: 1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm },
  stat: { width: '33.33%', minWidth: 96, gap: space.xxs, paddingRight: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
